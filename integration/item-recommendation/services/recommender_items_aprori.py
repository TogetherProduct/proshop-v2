"""
Apriori Recommender Module
===========================
Generates association rules between product categories using Apriori algorithm.
Finds what categories are often bought together.
"""

from efficient_apriori import apriori
import pickle


class AprioriRecommender:
    """
    Trains and stores Apriori association rules.
    Maps: category → [(category, lift, confidence, support), ...]
    """

    def __init__(self):
        self.rules_dict = {}
        self.itemsets = None
        self.rules = None

    def train(self, transactions, min_support=0.0002, min_confidence=0.1, max_length=3):
        """
        Train Apriori model on transaction list.
        
        Args:
            transactions: List of transaction lists, e.g., [['cat_a', 'cat_b'], ...]
            min_support: Minimum support threshold (0.0002)
            min_confidence: Minimum confidence threshold (0.1)
            max_length: Maximum itemset length (3)
        
        Returns:
            dict: Association rules indexed by antecedent category
        """
        print("=" * 60)
        print("APRIORI: Training association rules...")
        print("=" * 60)
        print(f"  Parameters: min_support={min_support}, "
              f"min_confidence={min_confidence}, max_length={max_length}")

        self.itemsets, self.rules = apriori(
            transactions,
            min_support=min_support,
            min_confidence=min_confidence,
            max_length=max_length
        )

        self.rules_dict = {}
        for rule in self.rules:
            lhs_items = list(rule.lhs)
            rhs_items = list(rule.rhs)

            if not lhs_items or not rhs_items:
                continue

            for lhs_cat in lhs_items:
                for rhs_cat in rhs_items:
                    if lhs_cat not in self.rules_dict:
                        self.rules_dict[lhs_cat] = []
                    
                    self.rules_dict[lhs_cat].append({
                        'category': rhs_cat,
                        'lift': round(rule.lift, 4),
                        'confidence': round(rule.confidence, 4),
                        'support': round(rule.support, 4),
                    })

        # Sort by lift score (descending)
        for cat in self.rules_dict:
            self.rules_dict[cat] = sorted(
                self.rules_dict[cat],
                key=lambda x: x['lift'],
                reverse=True
            )

        print(f"\n--- APRIORI TRAINING COMPLETE ---")
        print(f"  Rules generated: {len(self.rules)}")
        print(f"  Categories with rules: {len(self.rules_dict)}")
        if self.rules_dict:
            sample_cat = list(self.rules_dict.keys())[0]
            print(f"  Sample rules for '{sample_cat}':")
            for rule in self.rules_dict[sample_cat][:3]:
                print(f"    → {rule['category']} (lift={rule['lift']}, "
                      f"conf={rule['confidence']}, supp={rule['support']})")

        return self.rules_dict

    def get_recommendations(self, category, top_k=5):
        """
        Get recommended categories for a given category.
        
        Args:
            category: Source category
            top_k: Number of recommendations to return
        
        Returns:
            list: Top K recommended categories with scores
        """
        rules = self.rules_dict.get(category, [])
        return rules[:top_k]

    def save(self, filepath):
        """Save model to disk."""
        with open(filepath, 'wb') as f:
            pickle.dump(self.rules_dict, f)
        print(f"[AprioriRecommender] Model saved to {filepath}")

    def load(self, filepath):
        """Load model from disk."""
        with open(filepath, 'rb') as f:
            self.rules_dict = pickle.load(f)
        print(f"[AprioriRecommender] Model loaded from {filepath}")
