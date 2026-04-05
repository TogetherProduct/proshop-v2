"""
KNN Content-Based Recommender Module
====================================
Finds similar products based on physical attributes (weight, dimensions).
Uses cosine distance on normalized feature vectors.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
import pickle


class KNNContentRecommender:
    """
    Content-Based KNN recommender using product physical dimensions.
    Does NOT use category as feature (to avoid dominating cosine similarity).
    """

    def __init__(self):
        self.knn_model = None
        self.feature_matrix = None
        self.product_features = None
        self.scaler = None
        self.feature_columns = [
            'product_weight_g',
            'product_length_cm',
            'product_height_cm',
            'product_width_cm'
        ]

    def train(self, product_features_df, n_neighbors=30, metric='cosine'):
        """
        Train KNN model on product physical features.
        
        Args:
            product_features_df: DataFrame with columns:
                - product_id
                - product_category_name_english
                - product_weight_g, product_length_cm, product_height_cm, product_width_cm
            n_neighbors: Number of neighbors to find
            metric: Distance metric ('cosine' recommended)
        
        Returns:
            self for chaining
        """
        print("=" * 60)
        print("KNN CONTENT-BASED: Training...")
        print("=" * 60)

        # Reset index to align with feature_matrix rows
        self.product_features = product_features_df.reset_index(drop=True)

        # Extract numerical features
        feature_data = self.product_features[self.feature_columns].fillna(0).values

        # Normalize features
        self.scaler = StandardScaler()
        self.feature_matrix = self.scaler.fit_transform(feature_data)

        # Train KNN
        self.knn_model = NearestNeighbors(
            n_neighbors=n_neighbors,
            metric=metric,
            algorithm='brute'
        )
        self.knn_model.fit(self.feature_matrix)

        print(f"\n--- KNN CONTENT-BASED TRAINING COMPLETE ---")
        print(f"  Feature matrix shape: {self.feature_matrix.shape}")
        print(f"  Features used: {self.feature_columns}")
        print(f"  Metric: {metric}")
        print(f"  Number of products: {len(self.product_features)}")

        return self

    def get_recommendations(self, product_id, k=10, exclude_same_category=False):
        """
        Get similar products for a given product.
        
        Args:
            product_id: Product ID to find similar products for
            k: Number of recommendations to return
            exclude_same_category: If True, exclude products from same category
        
        Returns:
            list: Similar products with scores
                  [{'product_id': ..., 'score': ..., 'category': ...}, ...]
        """
        if self.knn_model is None:
            raise ValueError("Model not trained. Call train() first.")

        # Find product index
        product_rows = self.product_features[
            self.product_features['product_id'] == product_id
        ]
        if product_rows.empty:
            return []

        product_idx = product_rows.index[0]
        current_cat = product_rows.iloc[0]['product_category_name_english']

        # Query KNN (get more neighbors if filtering by category)
        n_query = k + 20 if exclude_same_category else k + 1
        distances, indices = self.knn_model.kneighbors(
            self.feature_matrix[product_idx].reshape(1, -1),
            n_neighbors=min(n_query, len(self.product_features))
        )

        recommendations = []
        for i in indices[0][1:]:  # Skip first (itself)
            neighbor_id = self.product_features.iloc[i]['product_id']
            neighbor_cat = self.product_features.iloc[i]['product_category_name_english']
            sim_score = round(1 - distances[0][list(indices[0]).index(i)], 4)

            if exclude_same_category and neighbor_cat == current_cat:
                continue

            recommendations.append({
                'product_id': neighbor_id,
                'score': sim_score,
                'category': neighbor_cat,
                'method': 'KNN Content-Based'
            })

            if len(recommendations) >= k:
                break

        return recommendations

    def save(self, filepath):
        """Save model to disk."""
        state = {
            'knn_model': self.knn_model,
            'feature_matrix': self.feature_matrix,
            'product_features': self.product_features,
            'scaler': self.scaler,
        }
        with open(filepath, 'wb') as f:
            pickle.dump(state, f)
        print(f"[KNNContentRecommender] Model saved to {filepath}")

    def load(self, filepath):
        """Load model from disk."""
        with open(filepath, 'rb') as f:
            state = pickle.load(f)
        self.knn_model = state['knn_model']
        self.feature_matrix = state['feature_matrix']
        self.product_features = state['product_features']
        self.scaler = state['scaler']
        print(f"[KNNContentRecommender] Model loaded from {filepath}")
