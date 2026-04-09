#!/usr/bin/env python3
"""
Visualization Script for Evaluation Results
============================================
Visualize evaluation results in tables and charts.

Usage:
    python visualize_results.py
    python visualize_results.py --input evaluation_results.json
"""

import json
import sys
from pathlib import Path
import pandas as pd
import numpy as np

try:
    import matplotlib.pyplot as plt
except ImportError:
    matplotlib_available = False
else:
    matplotlib_available = True


def load_results(filepath='models/evaluation_results.json'):
    """Load evaluation results from JSON."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: {filepath} not found")
        print("Please run: python eval_strategies.py first")
        sys.exit(1)


def print_table(results):
    """Print formatted results table."""
    print("\n" + "=" * 100)
    print("EVALUATION RESULTS - SUMMARY TABLE")
    print("=" * 100)
    
    # Extract metrics for each K
    k_values = set()
    for strategy_results in results['strategies'].values():
        for key in strategy_results.keys():
            if '@' in key:
                k = key.split('@')[1]
                k_values.add(int(k))
    
    k_values = sorted(k_values)
    
    for k in k_values:
        print(f"\n📊 Metrics @ K={k}\n")
        
        data = []
        for strategy_name, strategy_results in results['strategies'].items():
            data.append({
                'Strategy': strategy_name,
                f'Precision@{k}': f"{strategy_results.get(f'precision@{k}', 0):.4f}",
                f'Recall@{k}': f"{strategy_results.get(f'recall@{k}', 0):.4f}",
                f'MRR@{k}': f"{strategy_results.get(f'mrr@{k}', 0):.4f}",
            })
        
        df = pd.DataFrame(data)
        print(df.to_string(index=False))
        print()


def print_comparison(results):
    """Print strategy comparison."""
    print("\n" + "=" * 100)
    print("STRATEGY COMPARISON")
    print("=" * 100)
    
    strategies_info = {
        'Apriori Only': {
            'desc': 'Association rules from purchase patterns',
            'strengths': ['Fast computation', 'Interpretable rules', 'Good for patterns'],
            'weaknesses': ['Limited by transaction data', 'Miss diverse items', 'No cold-start solution'],
            'best_for': 'Pattern-heavy recommendations'
        },
        'KNN Content-Based': {
            'desc': 'Product similarity based on features',
            'strengths': ['Handles new products', 'Feature-based', 'Stable'],
            'weaknesses': ['Ignores user behavior', 'Limited feature engineering', 'Filter bubble'],
            'best_for': 'New product recommendations'
        },
        'KNN Collaborative': {
            'desc': 'Customer preference similarity',
            'strengths': ['User behavior focused', 'Finds trends', 'Captures preferences'],
            'weaknesses': ['Poor for niche items', 'Sparsity issues', 'Cold-start problem'],
            'best_for': 'Trending/popular recommendations'
        },
        'Full Hybrid': {
            'desc': 'Combination of all three approaches',
            'strengths': ['Best overall performance', 'Most robust', 'Handles edge cases'],
            'weaknesses': ['More complex', 'Higher latency', 'Harder to debug'],
            'best_for': 'Production systems'
        }
    }
    
    for strategy_name, info in strategies_info.items():
        print(f"\n🎯 {strategy_name}")
        print(f"   {info['desc']}")
        print(f"\n   Strengths:")
        for strength in info['strengths']:
            print(f"      [iconCheck] {strength}")
        print(f"\n   Weaknesses:")
        for weakness in info['weaknesses']:
            print(f"      ✗ {weakness}")
        print(f"\n   Best for: {info['best_for']}")


def print_winner(results):
    """Print winning strategy for each metric."""
    print("\n" + "=" * 100)
    print("🏆 WINNER BY METRIC")
    print("=" * 100)
    
    # Extract metrics for each K
    k_values = set()
    for strategy_results in results['strategies'].values():
        for key in strategy_results.keys():
            if '@' in key:
                k = key.split('@')[1]
                k_values.add(int(k))
    
    k_values = sorted(k_values)
    
    for k in k_values:
        print(f"\n@ K={k}:")
        
        # Best Precision
        best_p = max(
            results['strategies'].items(),
            key=lambda x: x[1].get(f'precision@{k}', 0)
        )
        print(f"  🥇 Best Precision: {best_p[0]:<25} {best_p[1].get(f'precision@{k}', 0):.4f}")
        
        # Best Recall
        best_r = max(
            results['strategies'].items(),
            key=lambda x: x[1].get(f'recall@{k}', 0)
        )
        print(f"  🥈 Best Recall:    {best_r[0]:<25} {best_r[1].get(f'recall@{k}', 0):.4f}")
        
        # Best MRR
        best_m = max(
            results['strategies'].items(),
            key=lambda x: x[1].get(f'mrr@{k}', 0)
        )
        print(f"  🥉 Best MRR:       {best_m[0]:<25} {best_m[1].get(f'mrr@{k}', 0):.4f}")


def plot_results(results):
    """Plot results with matplotlib."""
    if not matplotlib_available:
        print("\n⚠️  matplotlib not installed. Skipping plots.")
        print("   To enable: pip install matplotlib")
        return
    
    print("\n📊 Generating plots...")
    
    # Extract metrics for each K
    k_values = set()
    for strategy_results in results['strategies'].values():
        for key in strategy_results.keys():
            if '@' in key:
                k = key.split('@')[1]
                k_values.add(int(k))
    
    k_values = sorted(k_values)
    
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    strategies = list(results['strategies'].keys())
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
    
    # Plot each metric
    for idx, metric in enumerate(['precision', 'recall', 'mrr']):
        ax = axes[idx]
        
        x = np.arange(len(k_values))
        width = 0.2
        
        for i, strategy in enumerate(strategies):
            values = [
                results['strategies'][strategy].get(f'{metric}@{k}', 0)
                for k in k_values
            ]
            ax.bar(x + i * width, values, width, label=strategy, color=colors[i])
        
        ax.set_xlabel('K Value')
        ax.set_ylabel(metric.capitalize())
        ax.set_title(f'{metric.capitalize()}@K')
        ax.set_xticks(x + width * 1.5)
        ax.set_xticklabels(k_values)
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
    
    plt.tight_layout()
    save_path = Path('models/evaluation_plots.png')
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    print(f"   [iconCheck] Plots saved to: {save_path}")


def print_recommendations(results):
    """Print recommendations based on results."""
    print("\n" + "=" * 100)
    print("💡 RECOMMENDATIONS")
    print("=" * 100)
    
    # Find overall winner (best average precision at K=10)
    if 'precision@10' in results['strategies']['Full Hybrid']:
        precisions = {
            name: results['strategies'][name].get('precision@10', 0)
            for name in results['strategies']
        }
        winner = max(precisions, key=precisions.get)
        
        print(f"\n✅ Best Overall Strategy: {winner}")
        print(f"   Precision@10: {precisions[winner]:.4f}")
        print(f"\n   Use this strategy because:")
        
        if winner == 'Full Hybrid':
            print("      • Best robustness across all metrics")
            print("      • Handles edge cases and diverse products")
            print("      • Recommended for production systems")
        elif winner == 'Apriori Only':
            print("      • Strong pattern recognition")
            print("      • Fast computation")
            print("      • Consider using if performance similar to Hybrid")
        elif winner == 'KNN Content-Based':
            print("      • Excellent for new products")
            print("      • Good feature utilization")
            print("      • Consider for cold-start scenarios")
        elif winner == 'KNN Collaborative':
            print("      • Strong user preference modeling")
            print("      • Good for trending items")
            print("      • Consider for category-focused recommendations")
    
    print("\n📋 Next Steps:")
    print("   1. Review detailed metrics above")
    print("   2. Consider your use case (speed vs accuracy)")
    print("   3. Test with real users")
    print("   4. Monitor performance in production")
    print("   5. Re-evaluate monthly or on data changes")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Visualize evaluation results')
    parser.add_argument(
        '--input',
        default='models/evaluation_results.json',
        help='Path to evaluation results JSON'
    )
    parser.add_argument(
        '--plots',
        action='store_true',
        help='Generate matplotlib plots'
    )
    
    args = parser.parse_args()
    
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║            RECOMMENDATION STRATEGY EVALUATION - RESULTS VIEWER             ║
╚════════════════════════════════════════════════════════════════════════════╝
    """)
    
    results = load_results(args.input)
    
    print(f"Loaded results from: {args.input}")
    print(f"Timestamp: {results['timestamp']}")
    
    # Print all sections
    print_table(results)
    print_comparison(results)
    print_winner(results)
    print_recommendations(results)
    
    # Generate plots if requested
    if args.plots:
        plot_results(results)
    
    print("\n" + "=" * 100 + "\n")


if __name__ == '__main__':
    main()
