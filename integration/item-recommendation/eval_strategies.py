#!/usr/bin/env python3
"""
Comprehensive Strategy Evaluation Script
==========================================
Compare performance of all recommendation strategies:
- Apriori (Association Rules)
- KNN Content-Based (Product similarities)
- KNN Collaborative (Customer behavior)
- Full Hybrid (Combination of all three)

Usage:
    python eval_strategies.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import json
import random

# Import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services'))

from etl import etl_olist_data
from recommender_items_aprori import AprioriRecommender
from similar_items_knn import KNNContentRecommender
from hybrid_recommender import KNNCollaborativeRecommender
from pipeline import HybridRecommender
from storage import RecommendationStorage
from evaluation import compute_metrics


class StrategyEvaluator:
    """Evaluate all recommendation strategies."""
    
    def __init__(self, data_dir='./data', models_dir='./models'):
        self.data_dir = data_dir
        self.models_dir = models_dir
        self.storage = RecommendationStorage(models_dir)
        
        # Models
        self.apriori = None
        self.content_knn = None
        self.collab_knn = None
        self.hybrid = None
        
        # Data
        self.transactions = None
        self.product_features = None
        self.customer_cat_matrix = None
        self.id_to_cat = None
        
        # Results
        self.results = {}

    def setup(self):
        """Load/train all models."""
        print("\n" + "=" * 80)
        print("STRATEGY EVALUATION: SETUP")
        print("=" * 80)
        
        # Try to load existing models
        try:
            print("\n[1/2] Loading existing models from disk...")
            self.product_features = self.storage.load_product_features()
            self.transactions = self.storage.load_transactions()
            
            self.apriori = AprioriRecommender()
            self.content_knn = KNNContentRecommender()
            self.collab_knn = KNNCollaborativeRecommender()
            
            self.hybrid = HybridRecommender(
                self.apriori,
                self.content_knn,
                self.collab_knn,
                self.product_features
            )
            
            self.storage.load_models(self.hybrid)
            print("   [iconCheck] Models loaded successfully")
            
        except Exception as e:
            print(f"   Could not load models: {e}")
            print("   Training from scratch...")
            self._train_models()
        
        # Setup ID to category mapping
        self.id_to_cat = dict(zip(
            self.product_features['product_id'],
            self.product_features['product_category_name_english']
        ))
        
        print("\n[2/2] Data preparation...")
        print(f"   Total products: {len(self.product_features)}")
        print(f"   Total transactions: {len(self.transactions)}")
        print(f"   Total categories: {self.product_features['product_category_name_english'].nunique()}")
        print("   [iconCheck] Setup complete\n")

    def _train_models(self):
        """Train models from scratch."""
        print("\n   Loading and processing data...")
        self.transactions, self.product_features, self.customer_cat_matrix = (
            etl_olist_data(self.data_dir)
        )
        
        print("   Training Apriori...")
        self.apriori = AprioriRecommender()
        self.apriori.train(
            self.transactions,
            min_support=0.0002,
            min_confidence=0.1,
            max_length=3
        )
        
        print("   Training KNN Content-Based...")
        self.content_knn = KNNContentRecommender()
        self.content_knn.train(self.product_features, n_neighbors=30, metric='cosine')
        
        print("   Training KNN Collaborative...")
        self.collab_knn = KNNCollaborativeRecommender()
        self.collab_knn.train(
            self.customer_cat_matrix,
            self.product_features,
            n_neighbors=10,
            metric='cosine'
        )
        
        print("   Creating Hybrid...")
        self.hybrid = HybridRecommender(
            self.apriori,
            self.content_knn,
            self.collab_knn,
            self.product_features
        )
        
        print("   [iconCheck] Models trained and created")

    def evaluate(self, k_values=[5, 10, 15], test_size=0.2, num_samples=500):
        """
        Evaluate all strategies.
        
        Args:
            k_values: List of K values to evaluate at
            test_size: Percentage of data to use for testing
            num_samples: Number of transactions to sample for evaluation
        """
        print("\n" + "=" * 80)
        print("EVALUATION: Running comprehensive comparison")
        print("=" * 80)
        
        # Sample transactions for faster evaluation
        if len(self.transactions) > num_samples:
            print(f"\nSampling {num_samples} transactions from {len(self.transactions)}...")
            random.seed(42)
            sample_trans = random.sample(self.transactions, num_samples)
        else:
            sample_trans = self.transactions
        
        # Split data
        print("Splitting data for train/test...")
        train_trans, test_trans = train_test_split(
            sample_trans, test_size=test_size, random_state=42
        )
        
        print(f"  Training set: {len(train_trans)} transactions")
        print(f"  Test set: {len(test_trans)} transactions\n")
        
        # Define strategies
        strategies = {
            'Apriori Only': self._eval_apriori,
            'KNN Content-Based': self._eval_content,
            'KNN Collaborative': self._eval_collab,
            'Full Hybrid': self._eval_hybrid,
        }
        
        # Evaluate each strategy
        for strategy_name, strategy_func in strategies.items():
            print(f"→ Evaluating: {strategy_name}...")
            results = self._run_evaluation(strategy_func, test_trans, k_values)
            self.results[strategy_name] = results
            
            for k in k_values:
                print(f"    K={k}: Precision={results[f'precision@{k}']:.4f} | "
                      f"Recall={results[f'recall@{k}']:.4f} | "
                      f"MRR={results[f'mrr@{k}']:.4f}")
            print()
        
        self._print_summary(k_values)

    def _run_evaluation(self, strategy_func, test_transactions, k_values):
        """Run evaluation for a single strategy."""
        all_precisions = {f'precision@{k}': [] for k in k_values}
        all_recalls = {f'recall@{k}': [] for k in k_values}
        all_mrrs = {f'mrr@{k}': [] for k in k_values}
        
        for transaction in test_transactions:
            if len(transaction) < 2:
                continue
            
            try:
                current_cat = transaction[0]
                actual_cats = set(transaction[1:])
                
                predicted_products = strategy_func(current_cat)
                if not predicted_products:
                    continue
                
                # Convert product IDs to categories
                predicted_cats = [
                    self.id_to_cat.get(pid) for pid in predicted_products
                ]
                predicted_cats = [c for c in predicted_cats if c is not None]
                
                for k in k_values:
                    p, r, mrr = compute_metrics(predicted_cats[:k], actual_cats, k)
                    all_precisions[f'precision@{k}'].append(p)
                    all_recalls[f'recall@{k}'].append(r)
                    all_mrrs[f'mrr@{k}'].append(mrr)
                    
            except Exception as e:
                continue
        
        # Calculate averages
        results = {}
        for k in k_values:
            results[f'precision@{k}'] = np.mean(all_precisions[f'precision@{k}']) if all_precisions[f'precision@{k}'] else 0
            results[f'recall@{k}'] = np.mean(all_recalls[f'recall@{k}']) if all_recalls[f'recall@{k}'] else 0
            results[f'mrr@{k}'] = np.mean(all_mrrs[f'mrr@{k}']) if all_mrrs[f'mrr@{k}'] else 0
        
        return results

    def _eval_apriori(self, category):
        """Get predictions from Apriori strategy."""
        try:
            recs = self.apriori.get_recommendations(category, top_k=10)
            # Convert category to product IDs
            products = []
            for cat in [r['category'] for r in recs]:
                prod_list = self.product_features[
                    self.product_features['product_category_name_english'] == cat
                ]['product_id'].tolist()
                if prod_list:
                    products.append(prod_list[0])
            return products
        except:
            return []

    def _eval_content(self, category):
        """Get predictions from Content-Based strategy."""
        try:
            # Get sample product from category
            prod_list = self.product_features[
                self.product_features['product_category_name_english'] == category
            ]['product_id'].tolist()
            
            if not prod_list:
                return []
            
            sample_product = prod_list[0]
            recs = self.content_knn.get_recommendations(sample_product, k=10)
            return [r['product_id'] for r in recs]
        except:
            return []

    def _eval_collab(self, category):
        """Get predictions from Collaborative strategy."""
        try:
            recs = self.collab_knn.get_recommendations(category, k=10)
            # Convert to product IDs
            products = []
            for rec in recs:
                cat = rec.get('category')
                if cat:
                    prod_list = self.product_features[
                        self.product_features['product_category_name_english'] == cat
                    ]['product_id'].tolist()
                    if prod_list:
                        products.append(prod_list[0])
            return products
        except:
            return []

    def _eval_hybrid(self, category):
        """Get predictions from Hybrid strategy."""
        try:
            # Get sample product from category
            prod_list = self.product_features[
                self.product_features['product_category_name_english'] == category
            ]['product_id'].tolist()
            
            if not prod_list:
                return []
            
            sample_product = prod_list[0]
            recs = self.hybrid.get_recommendations(sample_product, k=10)
            return [r['product_id'] for r in recs]
        except:
            return []

    def _print_summary(self, k_values):
        """Print summary comparison table."""
        print("\n" + "=" * 80)
        print("EVALUATION RESULTS SUMMARY")
        print("=" * 80)
        
        for k in k_values:
            print(f"\n📊 Results @ K={k}\n")
            
            data = []
            for strategy_name, results in self.results.items():
                data.append({
                    'Strategy': strategy_name,
                    f'Precision@{k}': f"{results[f'precision@{k}']:.4f}",
                    f'Recall@{k}': f"{results[f'recall@{k}']:.4f}",
                    f'MRR@{k}': f"{results[f'mrr@{k}']:.4f}",
                })
            
            df = pd.DataFrame(data)
            print(df.to_string(index=False))
        
        # Find best strategy
        print(f"\n🏆 Best Strategies:\n")
        for k in k_values:
            best_precision = max(
                self.results.items(),
                key=lambda x: x[1][f'precision@{k}']
            )
            best_recall = max(
                self.results.items(),
                key=lambda x: x[1][f'recall@{k}']
            )
            
            print(f"  @ K={k}:")
            print(f"    - Best Precision: {best_precision[0]} ({best_precision[1][f'precision@{k}']:.4f})")
            print(f"    - Best Recall: {best_recall[0]} ({best_recall[1][f'recall@{k}']:.4f})")
        
        print("\n" + "=" * 80)

    def export_results(self, filename='evaluation_results.json'):
        """Export results to JSON."""
        export_data = {
            'timestamp': datetime.now().isoformat(),
            'strategies': self.results
        }
        
        filepath = Path(self.models_dir) / filename
        with open(filepath, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        print(f"\n[iconCheck] Results exported to: {filepath}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Evaluate all recommendation strategies'
    )
    parser.add_argument(
        '--data-dir',
        default='./data',
        help='Path to OLIST CSV files'
    )
    parser.add_argument(
        '--models-dir',
        default='./models',
        help='Path to save/load models'
    )
    parser.add_argument(
        '--k-values',
        type=int,
        nargs='+',
        default=[5, 10, 15],
        help='K values to evaluate at'
    )
    parser.add_argument(
        '--samples',
        type=int,
        default=500,
        help='Number of transactions to sample'
    )
    parser.add_argument(
        '--test-size',
        type=float,
        default=0.2,
        help='Test set percentage'
    )
    parser.add_argument(
        '--export',
        type=str,
        default='evaluation_results.json',
        help='Export results to JSON file'
    )
    
    args = parser.parse_args()
    
    evaluator = StrategyEvaluator(args.data_dir, args.models_dir)
    
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                    RECOMMENDATION STRATEGY EVALUATION                      ║
║                                                                            ║
║  This script compares the performance of:                                 ║
║    1. Apriori - Association rules (what products go together)             ║
║    2. KNN Content-Based - Product similarities (features)                 ║
║    3. KNN Collaborative - Customer behavior (co-purchasing)               ║
║    4. Full Hybrid - Combination of all three strategies                   ║
║                                                                            ║
║  Metrics evaluated:                                                        ║
║    - Precision@K: % of recommended items actually relevant                ║
║    - Recall@K: % of relevant items that were recommended                  ║
║    - MRR (Mean Reciprocal Rank): Position of first relevant item          ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    """)
    
    try:
        evaluator.setup()
        evaluator.evaluate(
            k_values=args.k_values,
            test_size=args.test_size,
            num_samples=args.samples
        )
        
        if args.export:
            evaluator.export_results(args.export)
        
        print("\n[iconCheck] Evaluation complete!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
