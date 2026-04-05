"""
ETL Module - Data Preparation for Recommendation Systems
=========================================================
Prepares data for all three recommendation engines:
  - Transactions for Apriori (category associations)
  - Product features for KNN Content-Based
  - Customer-Category matrix for KNN Collaborative
"""

import os
import pandas as pd
import numpy as np


def etl_olist_data(data_path):
    """
    Extract, Transform, Load data from OLIST dataset.
    
    Returns:
        tuple: (transactions, product_features, customer_cat_matrix)
    """
    print("=" * 60)
    print("ETL: Loading and processing data...")
    print("=" * 60)

    # Load CSV files
    orders = pd.read_csv(os.path.join(data_path, 'olist_orders_dataset.csv'))
    order_items = pd.read_csv(os.path.join(data_path, 'olist_order_items_dataset.csv'))
    products = pd.read_csv(os.path.join(data_path, 'olist_products_dataset.csv'))
    translation = pd.read_csv(os.path.join(data_path, 'product_category_name_translation.csv'))
    customers = pd.read_csv(os.path.join(data_path, 'olist_customers_dataset.csv'))

    # Keep only successfully delivered orders
    print("\n[ETL] Filtering delivered orders...")
    delivered = orders[orders['order_status'] == 'delivered'][['order_id', 'customer_id']]

    # Merge datasets
    print("[ETL] Merging datasets...")
    df = pd.merge(order_items, delivered, on='order_id')
    df = pd.merge(df, customers[['customer_id', 'customer_unique_id']], on='customer_id')
    df = pd.merge(df, products[['product_id', 'product_category_name']], on='product_id')
    df = pd.merge(df, translation, on='product_category_name', how='left')
    df['product_category_name_english'] = df['product_category_name_english'].fillna('others')

    print(f" Merged data shape: {df.shape}")
    print(f" Sample:\n{df.head()}")

    # --- PREPARE DATA FOR APRIORI ----
    # Transactions: each order = set of categories
    print("\n[ETL] Creating Transactions for Apriori...")
    transactions = (
        df.groupby('order_id')['product_category_name_english']
        .apply(lambda x: list(set(x)))
        .values.tolist()
    )
    transactions = [t for t in transactions if len(t) > 1]
    print(f" Transactions (orders with ≥2 categories): {len(transactions)}")
    if transactions:
        print(f" Sample transactions: {transactions[:3]}")

    # --- PREPARE DATA FOR KNN CONTENT-BASED ---
    # Product features: category + physical dimensions
    print("\n[ETL] Creating Product Features for KNN Content-Based...")
    product_features = products.copy()
    product_features = pd.merge(product_features, translation,
                                on='product_category_name', how='left')
    product_features['product_category_name_english'] = (
        product_features['product_category_name_english'].fillna('others')
    )
    keep_cols = ['product_id', 'product_category_name_english',
                 'product_weight_g', 'product_length_cm',
                 'product_height_cm', 'product_width_cm']
    product_features = product_features[keep_cols].fillna(0)
    print(f" Product features shape: {product_features.shape}")
    print(f" Sample:\n{product_features.head()}")

    # --- PREPARE DATA FOR KNN ITEM-BASED COLLABORATIVE ---
    # Binary matrix: customer (rows) × category (columns)
    print("\n[ETL] Creating Customer × Category matrix for KNN Collaborative...")
    customer_cat_matrix = pd.crosstab(
        df['customer_unique_id'],
        df['product_category_name_english']
    )
    customer_cat_matrix = (customer_cat_matrix > 0).astype(int)
    print(f" Matrix shape (customers × categories): {customer_cat_matrix.shape}")
    print(f" Sample:\n{customer_cat_matrix.head()}")

    # --- ETL SUMMARY ---
    print(f"\n{'='*60}")
    print(f"ETL COMPLETED")
    print(f"{'='*60}")
    print(f"  Transactions (Apriori):            {len(transactions)}")
    print(f"  Products (KNN Content):            {len(product_features)}")
    print(f"  Customer×Category matrix (Collab): {customer_cat_matrix.shape}")

    return transactions, product_features, customer_cat_matrix
