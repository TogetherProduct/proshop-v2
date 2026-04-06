# Offline Recommendation System Pipeline

A modular, production-ready recommendation system combining **Apriori** association rules, **KNN Content-Based**, and **KNN Collaborative** filtering into a unified hybrid recommender.

## Architecture

```
Data (CSV) ↓
    ├─→ ETL (etl.py)
    │   ├─→ Transactions (for Apriori)
    │   ├─→ Product Features (for KNN Content)
    │   └─→ Customer×Category Matrix (for KNN Collaborative)
    ↓
Training Models:
    ├─→ Apriori Rules (recommender_items_aprori.py)
    ├─→ KNN Content-Based (similar_items_knn.py)
    └─→ KNN Collaborative (hybrid_recommender.py)
    ↓
Storage (storage.py) → Models saved to disk
    ↓
Inference:
    └─→ Hybrid Pipeline (pipeline.py)
        Stage 1: Apriori Rules
        Stage 2: Collaborative Similarity
        Stage 3: Content-Based Similarity
```

## Project Structure

```
services/
├── etl.py                      # Data extraction & transformation
├── recommender_items_aprori.py # Apriori association rules
├── similar_items_knn.py        # KNN content-based similarity
├── hybrid_recommender.py       # KNN collaborative & collab class
├── pipeline.py                 # Hybrid recommender orchestration
├── storage.py                  # Model persistence & caching
├── evaluation.py               # Metrics & evaluation
└── docs/
    └── hybrid-recommendation-item.ipynb  # Original notebook

main.py                        # Main entry point
```

## Installation

```bash
cd integration/item-recommendation

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install pandas numpy scikit-learn efficient-apriori
```

## Usage

### 1. Train Models (First Time)

```bash
# From the item-recommendation directory
python main.py train --data-dir ./data

# Or with custom storage location
python main.py train --data-dir ./data --models-dir ./custom_models
```

This will:
- ✓ Load and preprocess OLIST dataset
- ✓ Train Apriori model
- ✓ Train KNN Content-Based model
- ✓ Train KNN Collaborative model
- ✓ Create Hybrid recommender
- ✓ Save all models to disk

### 2. Get Recommendations (Offline Inference)

```bash
# Single product recommendation
python main.py recommend --product-id "abc123def456" --k 10 --models-dir ./models

# Batch recommendations for 100 products
python main.py batch --k 10 --models-dir ./models
```

### 3. Check Pipeline Status

```bash
python main.py status --models-dir ./models
```

Output:
```
[Pipeline Status]
  Storage directory: ./models
  Models available: True
  Cached data:
    - Product features: True
    - Transactions: True
  Saved results: 1 files
```

## Python API Usage

### Training

```python
from main import OfflineRecommendationPipeline

# Create pipeline
pipeline = OfflineRecommendationPipeline(
    data_dir='./data',
    storage_dir='./models'
)

# Train all models
pipeline.train()

# Get status
pipeline.status()
```

### Inference (Offline)

```python
# Load trained models from disk
pipeline = OfflineRecommendationPipeline(
    data_dir='./data',
    storage_dir='./models'
)
pipeline.load_offline()

# Get recommendations for a product
recommendations = pipeline.get_recommendations(
    product_id='abc123def456',
    k=10
)

for rec in recommendations:
    print(f"Product: {rec['product_id']}")
    print(f"Score: {rec['score']}")
    print(f"Method: {rec['method']}\n")
```

### Batch Processing

```python
# Generate recommendations for multiple products
product_ids = ['prod1', 'prod2', 'prod3', ...]
results = pipeline.batch_recommend(product_ids, k=10)

# Save to JSON
pipeline.save_batch_recommendations(results, 'my_recommendations.json')
```

### Evaluation

```python
from services.evaluation import evaluate_all_strategies

# Evaluate different strategies
results_df = evaluate_all_strategies(
    pipeline.hybrid,
    pipeline.transactions,
    pipeline.product_features,
    k=6
)

print(results_df)
```

## Module Details

### ETL Module (`etl.py`)

Prepares data for all three engines:

```python
from services.etl import etl_olist_data

transactions, product_features, customer_cat_matrix = etl_olist_data('./data')
```

**Output:**
- `transactions`: List of category combinations per order
- `product_features`: DataFrame with product IDs, categories, and physical attributes
- `customer_cat_matrix`: Binary matrix (customers × categories)

### Apriori Recommender (`recommender_items_aprori.py`)

Finds categories often bought together:

```python
from services.recommender_items_aprori import AprioriRecommender

recommender = AprioriRecommender()
recommender.train(transactions, min_support=0.0002, min_confidence=0.1)

# Get recommendations
rules = recommender.get_recommendations('electronics', top_k=5)
# Returns: [
#   {'category': 'cables', 'lift': 2.45, 'confidence': 0.12, 'support': 0.001},
#   ...
# ]

# Save/load
recommender.save('apriori_model.pkl')
recommender.load('apriori_model.pkl')
```

### KNN Content-Based (`similar_items_knn.py`)

Finds products with similar physical attributes:

```python
from services.similar_items_knn import KNNContentRecommender

recommender = KNNContentRecommender()
recommender.train(product_features, n_neighbors=30)

# Get similar products
similar = recommender.get_recommendations(
    product_id='abc123',
    k=10,
    exclude_same_category=True
)
# Returns: [
#   {'product_id': 'xyz789', 'score': 0.85, 'category': 'accessories'},
#   ...
# ]
```

### KNN Collaborative (`hybrid_recommender.py`)

Finds categories with similar purchasing patterns:

```python
from services.hybrid_recommender import KNNCollaborativeRecommender

recommender = KNNCollaborativeRecommender()
recommender.train(customer_cat_matrix, product_features)

# Get similar categories
similar_cats = recommender.get_recommendations('electronics', k=5)
# Returns: [
#   {'category': 'accessories', 'products': [...], 'score': 0.78},
#   ...
# ]
```

### Hybrid Pipeline (`pipeline.py`)

Orchestrates all three models:

```python
from services.pipeline import HybridRecommender

hybrid = HybridRecommender(
    apriori_model,
    knn_content_model,
    knn_collab_model,
    product_features
)

# Get recommendations through 3-stage pipeline
recs = hybrid.get_recommendations('product_id', k=10)
# Returns: [
#   {
#     'product_id': '...',
#     'score': 0.85,
#     'method': 'Apriori (bundle: accessories, lift=2.45)'
#   },
#   ...
# ]
```

### Storage Layer (`storage.py`)

Persists models and data:

```python
from services.storage import RecommendationStorage

storage = RecommendationStorage('./models')

# Save
storage.save_models(hybrid_recommender, metadata={...})
storage.save_recommendations(recommendations, 'my_recs.json')

# Load
storage.load_models(hybrid_recommender)
recs = storage.load_recommendations('my_recs.json')

# Status
status = storage.get_status()
```

## Recommendation Pipeline (3 Stages)

When you request recommendations for a product:

### Stage 1: Apriori (Association Rules)
- Looks up the product's category
- Finds categories often bought together
- Retrieves products from those categories
- Scores by lift (strength of association)

### Stage 2: Collaborative Filtering
- Uses customer purchase patterns
- Finds categories with similar behavior
- Returns products from similar categories
- Scores by cosine similarity

### Stage 3: Content-Based
- Analyzes physical product features (weight, dimensions)
- Finds products with similar specifications
- Cross-category similarity (not limited to same category)
- Scores by feature similarity

**Why 3 stages?**
- **Apriori** ← Direct purchase history (what customers buy together)
- **Collaborative** ← Behavioral patterns (customers with similar tastes)
- **Content** ← Physical similarity (products that are alike)

Together they provide diverse, complementary recommendations.

## Configuration

### Training Parameters

Modify in `OfflineRecommendationPipeline.train()`:

```python
# Apriori
min_support=0.0002     # Frequency threshold
min_confidence=0.1     # Confidence threshold
max_length=3           # Max itemset size

# KNN
n_neighbors_content=30 # Content-based neighbors
n_neighbors_collab=10  # Collaborative neighbors
```

### Storage Locations

```
./models/
├── trained_models/          # Serialized models
│   ├── apriori_model.pkl
│   ├── content_knn_model.pkl
│   ├── collab_knn_model.pkl
│   └── metadata.json
├── cache/                   # Data cache
│   ├── product_features.parquet
│   └── transactions.pkl
└── results/                 # Output recommendations
    ├── recommendations.json
    └── evaluation_results.csv
```

## Performance

All models are optimized for offline inference (no API calls during recommendations).

Typical times (on OLIST dataset ~141K products):
- **Training**: 2-5 minutes
- **Single recommendation**: <50ms
- **Batch (1000 products)**: ~30-40 seconds

Models are cached in memory after first load.

## Evaluation

Compare strategies:

```python
from services.evaluation import evaluate_all_strategies

results = evaluate_all_strategies(hybrid, transactions, product_features)
print(results)
```

Output metrics:
- **Precision@K**: Fraction of K recommendations that are relevant
- **Recall@K**: Fraction of all relevant items that appear in K recommendations
- **MRR (Mean Reciprocal Rank)**: Average rank of first relevant item

## Advanced Usage

### Custom Training Parameters

```python
recommender = AprioriRecommender()
recommender.train(
    transactions,
    min_support=0.0001,
    min_confidence=0.05,
    max_length=4
)
```

### Model Persistence

```python
# Save individual models
apriori.save('my_apriori.pkl')
content_knn.save('my_content.pkl')
collab_knn.save('my_collab.pkl')

# Or save entire pipeline
storage.save_models(hybrid, metadata={'version': '1.0'})

# Later: load with zero training
hybrid.load('./models/trained_models')
```

### Batch Export

```python
# Generate for all products
all_products = product_features['product_id'].tolist()
batch_results = pipeline.batch_recommend(all_products, k=10)

# Export to JSON
pipeline.save_batch_recommendations(
    batch_results,
    'all_recommendations.json'
)

# Later: load from JSON
recs = storage.load_recommendations('all_recommendations.json')
```

## Troubleshooting

**Models not found**
```
FileNotFoundError: No cached product features found
```
→ Run `python main.py train` first to create models

**Product not found**
```
Empty recommendations for product_id
```
→ Product ID doesn't exist in dataset. Check spelling.

**Out of memory**
→ For very large datasets, process in batches using `batch_recommend()`

## Contributing

To add new strategies:

1. Create new recommender class (inherit pattern from existing ones)
2. Implement `train()` and `get_recommendations()`
3. Add to `HybridRecommender` pipeline in `pipeline.py`
4. Add to evaluation in `evaluation.py`

## License

Internal project for OLIST dataset analysis.

## References

- Original notebook: `services/docs/hybrid-recommendation-item.ipynb`
- Dataset: OLIST E-commerce (Kaggle)
- Algorithms: Apriori, KNN with cosine similarity
