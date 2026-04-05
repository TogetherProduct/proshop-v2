"""
Model Storage & Persistence Layer
==================================
Handles saving and loading models, embeddings, and recommendations offline.
"""

import os
import json
import pickle
import pandas as pd
from pathlib import Path


class RecommendationStorage:
    """
    Manages persistence of trained models and recommendation results.
    """

    def __init__(self, storage_dir='./models'):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.models_dir = self.storage_dir / 'trained_models'
        self.models_dir.mkdir(exist_ok=True)
        
        self.cache_dir = self.storage_dir / 'cache'
        self.cache_dir.mkdir(exist_ok=True)
        
        self.results_dir = self.storage_dir / 'results'
        self.results_dir.mkdir(exist_ok=True)

    def save_models(self, hybrid_recommender, metadata=None):
        """
        Save all trained models.
        
        Args:
            hybrid_recommender: HybridRecommender instance
            metadata: Optional dict with training info
        """
        print(f"\n[Storage] Saving models to {self.models_dir}...")
        
        hybrid_recommender.save(str(self.models_dir))
        
        # Save metadata
        if metadata:
            metadata_file = self.models_dir / 'metadata.json'
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2, default=str)
            print(f"  Metadata saved to {metadata_file}")

    def load_models(self, hybrid_recommender):
        """
        Load all trained models.
        
        Args:
            hybrid_recommender: HybridRecommender instance to populate
        """
        print(f"\n[Storage] Loading models from {self.models_dir}...")
        
        if not self.models_dir.exists():
            raise FileNotFoundError(f"Models directory not found: {self.models_dir}")
        
        hybrid_recommender.load(str(self.models_dir))

    def save_product_features(self, product_features_df):
        """Cache product features for quick reload."""
        cache_file = self.cache_dir / 'product_features.parquet'
        product_features_df.to_parquet(cache_file)
        print(f"  Product features cached to {cache_file}")

    def load_product_features(self):
        """Load cached product features."""
        cache_file = self.cache_dir / 'product_features.parquet'
        if cache_file.exists():
            return pd.read_parquet(cache_file)
        return None

    def save_transactions(self, transactions):
        """Cache transactions for quick reload."""
        cache_file = self.cache_dir / 'transactions.pkl'
        with open(cache_file, 'wb') as f:
            pickle.dump(transactions, f)
        print(f"  Transactions cached to {cache_file}")

    def load_transactions(self):
        """Load cached transactions."""
        cache_file = self.cache_dir / 'transactions.pkl'
        if cache_file.exists():
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        return None

    def save_recommendations(self, recommendations_dict, filename='recommendations.json'):
        """
        Save recommendations to JSON file.
        
        Args:
            recommendations_dict: Dict of product_id → recommendations
            filename: Output filename
        """
        output_file = self.results_dir / filename
        with open(output_file, 'w') as f:
            json.dump(recommendations_dict, f, indent=2)
        print(f"  Recommendations saved to {output_file}")

    def load_recommendations(self, filename='recommendations.json'):
        """Load recommendations from JSON file."""
        input_file = self.results_dir / filename
        if input_file.exists():
            with open(input_file, 'r') as f:
                return json.load(f)
        return None

    def save_evaluation_results(self, results_df, filename='evaluation_results.csv'):
        """Save evaluation metrics to CSV."""
        output_file = self.results_dir / filename
        results_df.to_csv(output_file, index=False)
        print(f"  Evaluation results saved to {output_file}")

    def load_evaluation_results(self, filename='evaluation_results.csv'):
        """Load evaluation results from CSV."""
        input_file = self.results_dir / filename
        if input_file.exists():
            return pd.read_csv(input_file)
        return None

    def get_status(self):
        """Get storage status and available cache."""
        status = {
            'storage_dir': str(self.storage_dir),
            'models_available': self._check_models(),
            'cache': {
                'product_features': (self.cache_dir / 'product_features.parquet').exists(),
                'transactions': (self.cache_dir / 'transactions.pkl').exists(),
            },
            'results': len(list(self.results_dir.glob('*.json'))),
        }
        return status

    def _check_models(self):
        """Check if all required models are saved."""
        required = [
            'apriori_model.pkl',
            'content_knn_model.pkl',
            'collab_knn_model.pkl',
        ]
        return all((self.models_dir / f).exists() for f in required)

    def clear_cache(self):
        """Clear cached data (keep trained models)."""
        import shutil
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir)
            self.cache_dir.mkdir()
        print("[Storage] Cache cleared")
