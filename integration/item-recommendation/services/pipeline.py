"""
Hybrid Recommender Pipeline
============================
Combines Apriori, KNN Content-Based, and KNN Collaborative in a 3-stage pipeline.
"""

import pandas as pd


class HybridRecommender:
    """
    Hybrid recommendation engine combining 3 strategies:
    1. Stage 1 (Apriori): Association rules from purchase history
    2. Stage 2 (Collaborative): Similar categories from customer behavior
    3. Stage 3 (Content):    Similar products from physical attributes
    """

    def __init__(self, apriori_model, knn_content_model, knn_collab_model, product_features_df):
        """
        Initialize hybrid recommender with trained models.
        
        Args:
            apriori_model: Trained AprioriRecommender instance
            knn_content_model: Trained KNNContentRecommender instance
            knn_collab_model: Trained KNNCollaborativeRecommender instance
            product_features_df: DataFrame with product info
        """
        self.apriori = apriori_model
        self.content_knn = knn_content_model
        self.collab_knn = knn_collab_model
        self.product_features = product_features_df
        
        # Build ID to category mapping
        self.product_id_to_category = dict(zip(
            product_features_df['product_id'],
            product_features_df['product_category_name_english']
        ))

    def get_recommendations(self, product_id, k=10):
        """
        Get hybrid recommendations for a product using 3-stage pipeline.
        
        Args:
            product_id: Product ID
            k: Number of recommendations to return
        
        Returns:
            list: Recommended products with scores and methods
                  [{'product_id': ..., 'score': ..., 'method': ...}, ...]
        """
        final_recs = []
        seen_ids = {product_id}

        # Get product info
        product_rows = self.product_features[
            self.product_features['product_id'] == product_id
        ]
        if product_rows.empty:
            return []

        current_category = product_rows.iloc[0]['product_category_name_english']

        # ===== STAGE 1: APRIORI RULES =====
        apriori_recommendations = self._stage_apriori(current_category, k, seen_ids)
        final_recs.extend(apriori_recommendations)

        # ===== STAGE 2: KNN COLLABORATIVE =====
        if len(final_recs) < k:
            collab_recommendations = self._stage_collaborative(
                current_category, k - len(final_recs), seen_ids
            )
            final_recs.extend(collab_recommendations)

        # ===== STAGE 3: KNN CONTENT-BASED =====
        if len(final_recs) < k:
            content_recommendations = self._stage_content(
                product_id, current_category, k - len(final_recs), seen_ids
            )
            final_recs.extend(content_recommendations)

        return final_recs[:k]

    def _stage_apriori(self, category, max_count, seen_ids, max_per_category=3):
        """
        Stage 1: Get recommendations from Apriori association rules.
        Diversifies by limiting products per category to ensure multiple categories in recommendations.
        
        Args:
            category: Source category
            max_count: Maximum total recommendations
            seen_ids: Set of already seen product IDs
            max_per_category: Max products per category (default: 3)
        """
        recommendations = []
        rules = self.apriori.get_recommendations(category, top_k=10)
        
        # First pass: collect recommendations with per-category limit for diversity
        category_product_map = {}  # category -> list of products
        
        for rule in rules:
            target_category = rule['category']
            products = self.collab_knn.category_to_products.get(target_category, [])
            
            if products:
                # Store rule info with products for this category
                category_product_map[target_category] = {
                    'products': products,
                    'lift': rule['lift'],
                    'confidence': rule['confidence'],
                }
        
        # Second pass: collect products, limiting per category for diversity
        category_counts = {}  # Track products per category
        
        for target_category in sorted(
            category_product_map.keys(),
            key=lambda c: category_product_map[c]['lift'],
            reverse=True
        ):
            rule_info = category_product_map[target_category]
            category_counts[target_category] = 0
            
            for product_id in rule_info['products']:
                if product_id not in seen_ids and category_counts[target_category] < max_per_category:
                    recommendations.append({
                        'product_id': product_id,
                        'score': rule_info['lift'],
                        'method': f"Apriori (bundle: {target_category}, lift={rule_info['lift']})"
                    })
                    seen_ids.add(product_id)
                    category_counts[target_category] += 1
                    
                    if len(recommendations) >= max_count:
                        return recommendations

        return recommendations

    def _stage_collaborative(self, category, max_count, seen_ids, max_per_category=2):
        """
        Stage 2: Get recommendations from collaborative similarity.
        Diversifies by limiting products per category.
        
        Args:
            category: Source category
            max_count: Maximum total recommendations
            seen_ids: Set of already seen product IDs
            max_per_category: Max products per category (default: 2)
        """
        recommendations = []
        collab_recs = self.collab_knn.get_recommendations(category, k=10)
        
        category_counts = {}  # Track products per category
        
        for rec in collab_recs:
            neighbor_cat = rec['category']
            category_counts[neighbor_cat] = 0
            
            for product_id in rec['products']:
                if product_id not in seen_ids and category_counts[neighbor_cat] < max_per_category:
                    recommendations.append({
                        'product_id': product_id,
                        'score': rec['score'],
                        'method': f"KNN Collab (similar behavior: {neighbor_cat}, sim={rec['score']})"
                    })
                    seen_ids.add(product_id)
                    category_counts[neighbor_cat] += 1
                    if len(recommendations) >= max_count:
                        return recommendations

        return recommendations

    def _stage_content(self, product_id, current_category, max_count, seen_ids):
        """Stage 3: Get recommendations from content-based similarity."""
        recommendations = []
        content_recs = self.content_knn.get_recommendations(
            product_id, k=30, exclude_same_category=True
        )

        for rec in content_recs:
            if rec['product_id'] not in seen_ids:
                recommendations.append({
                    'product_id': rec['product_id'],
                    'score': rec['score'],
                    'method': f"KNN Content (similar attributes: {rec['category']}, sim={rec['score']})"
                })
                seen_ids.add(rec['product_id'])
                if len(recommendations) >= max_count:
                    return recommendations

        return recommendations

    def save(self, directory):
        """Save all models to directory."""
        import os
        os.makedirs(directory, exist_ok=True)
        self.apriori.save(os.path.join(directory, 'apriori_model.pkl'))
        self.content_knn.save(os.path.join(directory, 'content_knn_model.pkl'))
        self.collab_knn.save(os.path.join(directory, 'collab_knn_model.pkl'))
        print(f"[HybridRecommender] All models saved to {directory}")

    def load(self, directory):
        """Load all models from directory."""
        import os
        self.apriori.load(os.path.join(directory, 'apriori_model.pkl'))
        self.content_knn.load(os.path.join(directory, 'content_knn_model.pkl'))
        self.collab_knn.load(os.path.join(directory, 'collab_knn_model.pkl'))
        print(f"[HybridRecommender] All models loaded from {directory}")
