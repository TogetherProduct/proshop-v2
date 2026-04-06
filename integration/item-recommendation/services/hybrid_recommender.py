"""
KNN Item-Based Collaborative Recommender Module
===============================================
Finds similar categories based on customer purchase patterns.
Uses cosine similarity on customer-category matrix.
"""

import pandas as pd
import numpy as np
from sklearn.neighbors import NearestNeighbors
import pickle


class KNNCollaborativeRecommender:
    """
    Item-Based Collaborative KNN using customer purchase behavior.
    Creates vectors for each category based on which customers bought from it.
    """

    def __init__(self):
        self.knn_model = None
        self.cat_customer_matrix = None
        self.category_names = []
        self.category_to_products = {}

    def train(self, customer_cat_matrix, product_features_df, n_neighbors=10, metric='cosine'):
        """
        Train collaborative KNN model.
        
        Args:
            customer_cat_matrix: DataFrame with customers (rows) × categories (cols)
            product_features_df: DataFrame with product_id and product_category_name_english
            n_neighbors: Number of neighbors per category
            metric: Distance metric ('cosine' recommended)
        
        Returns:
            self for chaining
        """
        print("=" * 60)
        print("KNN COLLABORATIVE: Training...")
        print("=" * 60)

        # Transpose: rows = categories, cols = customers
        self.cat_customer_matrix = customer_cat_matrix.T

        # Train KNN on categories
        self.knn_model = NearestNeighbors(
            n_neighbors=min(n_neighbors, len(self.cat_customer_matrix)),
            metric=metric,
            algorithm='brute'
        )
        self.knn_model.fit(self.cat_customer_matrix.values)

        self.category_names = self.cat_customer_matrix.index.tolist()

        # Build category → products mapping
        self.category_to_products = (
            product_features_df.groupby('product_category_name_english')['product_id']
            .apply(list).to_dict()
        )

        print(f"\n--- KNN COLLABORATIVE TRAINING COMPLETE ---")
        print(f"  Categories: {len(self.category_names)}")
        print(f"  Customers: {self.cat_customer_matrix.shape[1]}")
        print(f"  Matrix shape (categories × customers): {self.cat_customer_matrix.shape}")
        print(f"  Metric: {metric}")
        if self.category_to_products:
            sample_cat = list(self.category_to_products.keys())[0]
            print(f"  Sample: '{sample_cat}' has "
                  f"{len(self.category_to_products[sample_cat])} products")

        return self

    def get_recommendations(self, category, k=10):
        """
        Get similar categories based on customer behavior.
        
        Args:
            category: Source category
            k: Number of recommendations to return
        
        Returns:
            list: Similar categories with their products
                  [{'category': ..., 'products': [...], 'score': ...}, ...]
        """
        if self.knn_model is None:
            raise ValueError("Model not trained. Call train() first.")

        if category not in self.category_names:
            return []

        cat_idx = self.category_names.index(category)

        # Query KNN
        distances, indices = self.knn_model.kneighbors(
            [self.cat_customer_matrix.iloc[cat_idx].values],
            n_neighbors=min(k + 1, len(self.category_names))
        )

        recommendations = []
        for i in range(1, len(indices[0])):  # Skip first (itself)
            neighbor_idx = indices[0][i]
            neighbor_cat = self.category_names[neighbor_idx]
            sim_score = round(1 - distances[0][i], 4)

            if sim_score <= 0:
                continue

            recommendations.append({
                'category': neighbor_cat,
                'products': self.category_to_products.get(neighbor_cat, []),
                'score': sim_score,
                'method': 'KNN Collaborative'
            })

            if len(recommendations) >= k:
                break

        return recommendations

    def save(self, filepath):
        """Save model to disk."""
        state = {
            'knn_model': self.knn_model,
            'cat_customer_matrix': self.cat_customer_matrix,
            'category_names': self.category_names,
            'category_to_products': self.category_to_products,
        }
        with open(filepath, 'wb') as f:
            pickle.dump(state, f)
        print(f"[KNNCollaborativeRecommender] Model saved to {filepath}")

    def load(self, filepath):
        """Load model from disk."""
        with open(filepath, 'rb') as f:
            state = pickle.load(f)
        self.knn_model = state['knn_model']
        self.cat_customer_matrix = state['cat_customer_matrix']
        self.category_names = state['category_names']
        self.category_to_products = state['category_to_products']
        print(f"[KNNCollaborativeRecommender] Model loaded from {filepath}")
