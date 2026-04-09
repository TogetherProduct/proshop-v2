"""
Evaluation Module
=================
Metrics and evaluation for recommendation system performance.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split


def compute_metrics(predicted_categories, actual_categories_set, k):
    """
    Compute Precision@K, Recall@K, and MRR.
    
    Args:
        predicted_categories: List of predicted category names
        actual_categories_set: Set of actual category names
        k: Cutoff for metrics
    
    Returns:
        tuple: (precision, recall, mrr)
    """
    predicted_top_k = predicted_categories[:k]
    hits = len(set(predicted_top_k) & actual_categories_set)
    
    precision = hits / k if k > 0 else 0
    recall = hits / len(actual_categories_set) if actual_categories_set else 0
    
    # Mean Reciprocal Rank
    mrr = 0
    for i, cat in enumerate(predicted_top_k):
        if cat in actual_categories_set:
            mrr = 1 / (i + 1)
            break
    
    return precision, recall, mrr


def evaluate_strategy(transactions, strategy_func, test_trans, product_features, k=6):
    """
    Evaluate a single recommendation strategy.
    
    Args:
        transactions: All transactions (for training if needed)
        strategy_func: Function that takes transaction and returns predicted categories
        test_trans: Transactions to evaluate on
        product_features: Product feature dataframe
        k: Number of recommendations to evaluate at
    
    Returns:
        tuple: (precisions, recalls, mrrs) - average metrics
    """
    precisions, recalls, mrrs = [], [], []
    
    id_to_cat = dict(zip(
        product_features['product_id'],
        product_features['product_category_name_english']
    ))
    
    for transaction in test_trans:
        if len(transaction) < 2:
            continue
        
        current_cat = transaction[0]
        actual_cats = set(transaction[1:])
        
        try:
            predicted_categories = strategy_func(current_cat, transaction[0])
            p, r, mrr = compute_metrics(predicted_categories, actual_cats, k)
            precisions.append(p)
            recalls.append(r)
            mrrs.append(mrr)
        except Exception as e:
            print(f"Error evaluating strategy: {e}")
            continue
    
    return np.mean(precisions) if precisions else 0, \
           np.mean(recalls) if recalls else 0, \
           np.mean(mrrs) if mrrs else 0


def evaluate_all_strategies(hybrid_recommender, transactions, product_features, k=6):
    """
    Comprehensive evaluation of all strategies.
    
    Args:
        hybrid_recommender: HybridRecommender instance
        transactions: All transactions
        product_features: Product dataframe
        k: Cutoff for metrics
    
    Returns:
        pd.DataFrame: Evaluation results with metrics for each strategy
    """
    print("\n" + "=" * 70)
    print("EVALUATION: Comparing all strategies")
    print("=" * 70)
    
    # Split data
    train_trans, test_trans = train_test_split(
        transactions, test_size=0.2, random_state=42
    )
    
    id_to_cat = dict(zip(
        product_features['product_id'],
        product_features['product_category_name_english']
    ))
    
    results = []
    
    strategies = {
        'Apriori Only': lambda cid: [
            r['category'] for r in hybrid_recommender.apriori.get_recommendations(cid, top_k=k)
        ],
        'KNN Content Only': lambda cid: _eval_content_only(
            cid, hybrid_recommender, product_features, id_to_cat, k
        ),
        'KNN Collab Only': lambda cid: _eval_collab_only(
            cid, hybrid_recommender, k
        ),
        'Full Hybrid': lambda pid: [
            id_to_cat.get(r['product_id']) 
            for r in hybrid_recommender.get_recommendations(pid, k=k)
        ],
    }
    
    for strategy_name, strategy_func in strategies.items():
        print(f"\n  → Evaluating: {strategy_name}...")
        precisions, recalls, mrrs = [], [], []
        
        for transaction in test_trans:
            if len(transaction) < 2:
                continue
            
            current_cat = transaction[0]
            actual_cats = set(transaction[1:])
            
            sample_product = hybrid_recommender.collab_knn.category_to_products.get(
                current_cat, [None]
            )[0]
            
            if not sample_product:
                continue
            
            try:
                if 'Full Hybrid' in strategy_name:
                    pred_categories = strategy_func(sample_product)
                else:
                    pred_categories = strategy_func(current_cat)
                
                p, r, mrr = compute_metrics(pred_categories, actual_cats, k)
                precisions.append(p)
                recalls.append(r)
                mrrs.append(mrr)
            except Exception as e:
                continue
        
        avg_p = round(np.mean(precisions) if precisions else 0, 4)
        avg_r = round(np.mean(recalls) if recalls else 0, 4)
        avg_mrr = round(np.mean(mrrs) if mrrs else 0, 4)
        
        results.append({
            'Strategy': strategy_name,
            f'Precision@{k}': avg_p,
            f'Recall@{k}': avg_r,
            'MRR': avg_mrr,
        })
        
        print(f"     Precision={avg_p:.4f}  Recall={avg_r:.4f}  MRR={avg_mrr:.4f}")
    
    print("\n" + "=" * 70)
    results_df = pd.DataFrame(results)
    print("Evaluation Results:")
    print(results_df.to_string(index=False))
    
    return results_df


def _eval_content_only(category, hybrid_recommender, product_features, id_to_cat, k):
    """Helper: Get predictions from content-based only."""
    sample_product = hybrid_recommender.collab_knn.category_to_products.get(
        category, [None]
    )[0]
    if not sample_product:
        return []
    recs = hybrid_recommender.content_knn.get_recommendations(
        sample_product, k=k, exclude_same_category=True
    )
    return [id_to_cat.get(r['product_id']) for r in recs]


def _eval_collab_only(category, hybrid_recommender, k):
    """Helper: Get predictions from collaborative only."""
    recs = hybrid_recommender.collab_knn.get_recommendations(category, k=k)
    result_cats = []
    for rec in recs:
        result_cats.append(rec['category'])
    return result_cats
