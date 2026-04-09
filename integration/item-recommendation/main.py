"""
Offline Recommendation Pipeline Orchestrator
=============================================
Main entry point for training and running the complete pipeline offline.
Handles: ETL → Training → Storage → Inference
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd

# Import all modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services'))

from etl import etl_olist_data
from recommender_items_aprori import AprioriRecommender
from similar_items_knn import KNNContentRecommender
from hybrid_recommender import KNNCollaborativeRecommender
from pipeline import HybridRecommender
from storage import RecommendationStorage


class OfflineRecommendationPipeline:
    """
    Complete offline pipeline for training and inference.
    """

    def __init__(self, data_dir, storage_dir='./models'):
        """
        Initialize the pipeline.
        
        Args:
            data_dir: Directory containing OLIST CSV files
            storage_dir: Directory for saving/loading models
        """
        self.data_dir = data_dir
        self.storage = RecommendationStorage(storage_dir)
        
        # Models
        self.apriori = None
        self.content_knn = None
        self.collab_knn = None
        self.hybrid = None
        
        # Data
        self.transactions = None
        self.product_features = None
        self.customer_cat_matrix = None

    def train(self, force_retrain=False):
        """
        Train all models from scratch.
        
        Args:
            force_retrain: If True, ignore cached data and retrain
        
        Returns:
            self for chaining
        """
        print("\n" + "=" * 70)
        print("OFFLINE PIPELINE: TRAINING MODE")
        print("=" * 70)
        
        # Step 1: ETL
        print("\n[1/5] ETL - Loading and processing data...")
        self.transactions, self.product_features, self.customer_cat_matrix = (
            etl_olist_data(self.data_dir)
        )
        
        # Cache data
        self.storage.save_transactions(self.transactions)
        self.storage.save_product_features(self.product_features)
        
        # Step 2: Train Apriori
        print("\n[2/5] Training Apriori model...")
        self.apriori = AprioriRecommender()
        self.apriori.train(
            self.transactions,
            min_support=0.0002,
            min_confidence=0.1,
            max_length=3
        )
        
        # Step 3: Train KNN Content-Based
        print("\n[3/5] Training KNN Content-Based model...")
        self.content_knn = KNNContentRecommender()
        self.content_knn.train(self.product_features, n_neighbors=30, metric='cosine')
        
        # Step 4: Train KNN Collaborative
        print("\n[4/5] Training KNN Collaborative model...")
        self.collab_knn = KNNCollaborativeRecommender()
        self.collab_knn.train(
            self.customer_cat_matrix,
            self.product_features,
            n_neighbors=10,
            metric='cosine'
        )
        
        # Step 5: Create Hybrid Model
        print("\n[5/5] Creating Hybrid Recommender...")
        self.hybrid = HybridRecommender(
            self.apriori,
            self.content_knn,
            self.collab_knn,
            self.product_features
        )
        
        # Save all models
        metadata = {
            'trained_at': datetime.now().isoformat(),
            'data_dir': str(self.data_dir),
            'num_transactions': len(self.transactions),
            'num_products': len(self.product_features),
            'num_customers': self.customer_cat_matrix.shape[0],
            'num_categories': self.customer_cat_matrix.shape[1],
        }
        self.storage.save_models(self.hybrid, metadata)
        
        print("\n" + "=" * 70)
        print("[iconCheck] TRAINING COMPLETE")
        print("=" * 70)
        print(f"  Models saved to: {self.storage.models_dir}")
        print(f"  Cache saved to: {self.storage.cache_dir}")
        
        return self

    def load_offline(self):
        """
        Load all models from disk for inference (no training).
        
        Returns:
            self for chaining
        """
        print("\n" + "=" * 70)
        print("OFFLINE PIPELINE: INFERENCE MODE (Loading from disk)")
        print("=" * 70)
        
        # Load cached data
        print("\n[1/3] Loading cached data...")
        self.product_features = self.storage.load_product_features()
        self.transactions = self.storage.load_transactions()
        
        if self.product_features is None:
            raise FileNotFoundError("No cached product features found. Run train() first.")
        
        # Initialize models (they'll be loaded from disk)
        print("[2/3] Initializing models...")
        self.apriori = AprioriRecommender()
        self.content_knn = KNNContentRecommender()
        self.collab_knn = KNNCollaborativeRecommender()
        
        # Load models
        print("[3/3] Loading trained models...")
        self.hybrid = HybridRecommender(
            self.apriori,
            self.content_knn,
            self.collab_knn,
            self.product_features
        )
        self.storage.load_models(self.hybrid)
        
        print("\n" + "=" * 70)
        print("[iconCheck] MODELS LOADED SUCCESSFULLY")
        print("=" * 70)
        
        return self

    def get_recommendations(self, product_id, k=10):
        """
        Get recommendations for a product.
        
        Args:
            product_id: Product ID
            k: Number of recommendations
        
        Returns:
            list: Recommended products
        """
        if self.hybrid is None:
            raise ValueError("Models not loaded. Call train() or load_offline() first.")
        
        recommendations = self.hybrid.get_recommendations(product_id, k=k)
        return recommendations

    def batch_recommend(self, product_ids, k=10):
        """
        Get recommendations for multiple products.
        
        Args:
            product_ids: List of product IDs
            k: Number of recommendations per product
        
        Returns:
            dict: {product_id: [recommendations], ...}
        """
        print(f"\n[Batch] Generating recommendations for {len(product_ids)} products...")
        results = {}
        
        for i, pid in enumerate(product_ids):
            recs = self.get_recommendations(pid, k=k)
            results[pid] = recs
            
            if (i + 1) % max(1, len(product_ids) // 10) == 0:
                print(f"  {i + 1}/{len(product_ids)} completed ({100 * (i + 1) // len(product_ids)}%)")
        
        print("  [iconCheck] Batch complete")
        return results

    def save_batch_recommendations(self, results, filename='recommendations.json'):
        """Save batch results to JSON."""
        # Convert to JSON-serializable format
        json_results = {}
        for product_id, recs in results.items():
            json_results[str(product_id)] = [
                {
                    'product_id': rec['product_id'],
                    'score': rec['score'],
                    'method': rec['method']
                }
                for rec in recs
            ]
        self.storage.save_recommendations(json_results, filename)

    def status(self):
        """Print pipeline status and available resources."""
        status = self.storage.get_status()
        
        print("\n[Pipeline Status]")
        print(f"  Storage directory: {status['storage_dir']}")
        print(f"  Models available: {status['models_available']}")
        print(f"  Cached data:")
        print(f"    - Product features: {status['cache']['product_features']}")
        print(f"    - Transactions: {status['cache']['transactions']}")
        print(f"  Saved results: {status['results']} files")
        
        return status


# ============================================================
# Simple CLI interface
# ============================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Offline Recommendation Pipeline for OLIST Dataset'
    )
    parser.add_argument(
        'command',
        nargs='?',
        choices=['train', 'recommend', 'batch', 'status'],
        help='Command to execute'
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
        '--product-id',
        type=str,
        help='Product ID for recommendations'
    )
    parser.add_argument(
        '--k',
        type=int,
        default=10,
        help='Number of recommendations'
    )
    
    args = parser.parse_args()
    
    if not args.command:
        args.command = 'status'
    
    pipeline = OfflineRecommendationPipeline(args.data_dir, args.models_dir)
    
    if args.command == 'train':
        print("Training pipeline...")
        pipeline.train()
        
    elif args.command == 'recommend':
        if not args.product_id:
            print("Error: --product-id required for recommend command")
            sys.exit(1)
        print(f"Loading models and generating recommendations for {args.product_id}...")
        pipeline.load_offline()
        recs = pipeline.get_recommendations(args.product_id, k=args.k)
        print(f"\nTop {args.k} recommendations for product {args.product_id}:")
        for i, rec in enumerate(recs, 1):
            print(f"  {i}. Product: {rec['product_id']}")
            print(f"     Score: {rec['score']}")
            print(f"     Method: {rec['method']}\n")
    
    elif args.command == 'batch':
        print("Loading models for batch processing...")
        pipeline.load_offline()
        # Generate recommendations for all products
        all_products = pipeline.product_features['product_id'].tolist()[:100]  # Sample
        results = pipeline.batch_recommend(all_products, k=args.k)
        pipeline.save_batch_recommendations(results)
        print(f"[iconCheck] Saved recommendations to {pipeline.storage.results_dir}")
    
    elif args.command == 'status':
        pipeline.status()


if __name__ == "__main__":
    main()
