### Env Variables

Rename the `.env.example` file to `.env` and add the following

```
NODE_ENV = development
PORT = 5000
MONGO_URI = your mongodb uri
JWT_SECRET = 'abc123'
PAYPAL_CLIENT_ID = your paypal client id
PAGINATION_LIMIT = 8

# Redis Configuration (for recommendations caching)
REDIS_HOST = localhost
REDIS_PORT = 6379
REDIS_PASSWORD = 

# Batch Recommendation Scheduler
BATCH_CRON_SCHEDULE = 0 2 * * *
PYTHON_VENV_PATH = integration/item-recommendation/.venv
```

Change the JWT_SECRET and PAGINATION_LIMIT to what you want

### Install Dependencies (frontend & backend)

```
npm install
cd frontend
npm install
```

### Run

```

# Run frontend (:3000) & backend (:5000)
npm run dev

# Run backend only
npm run server
```

## Build & Deploy

```
# Create frontend prod build
cd frontend
npm run build
```

### Seed Database

```
# Import data
npm run data:import

# Destroy data
npm run data:destroy
```

---

# Prepare data for item recommendation and revenue forecast
Place OLIST dataset CSVs in `integration/data/`:
- `olist_customers_dataset.csv`
- `olist_orders_dataset.csv`
- `olist_order_items_dataset.csv`
- `olist_order_payments_dataset.csv`
- `olist_order_reviews_dataset.csv`
- `olist_products_dataset.csv`
- `olist_sellers_dataset.csv`
- `olist_geolocation_dataset.csv`
- `product_category_name_translation.csv`


## Item Recommendation System

The system uses machine learning models to provide personalized product recommendations using a 3-layer caching architecture.

### Setup Recommendation System

#### 1. Install Python Dependencies

```bash
cd integration/item-recommendation
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r pyproject.toml
# try `pip install .` if the above doesn't works
```

#### 3. Train ML Models

```bash
cd integration/item-recommendation
source .venv/bin/activate
# run python main.py train --data-dir ../data
# to train first
python main.py train --data-dir ../data
python main.py batch
python main.py
```

This will generate trained models in `models/trained_models/`:
- `apriori_model.pkl` - Association rules
- `knn_content_model.pkl` - Content-based similarity
- `knn_collaborative_model.pkl` - Collaborative filtering
- `hybrid_model.pkl` - Ensemble model

#### 4. Setup Redis (Optional but Recommended)

```bash
# Install Redis
brew install redis  # macOS
# or
sudo apt-get install redis-server  # Linux

# Start Redis
redis-server
```

### Running the Project with Recommendations

```bash
# Terminal 1: Backend with recommendation scheduler
npm run server

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: (Optional) Redis server
redis-server
```

---
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
---
## Item-recommendation FAQ bs, the stuff below doesn't matters
### API Endpoints for Recommendations

#### Get Recommendations for a Product
```
GET /api/products/:id/recommendations
```

Response:
```json
{
  "productId": "product123",
  "recommendations": [
    {
      "productId": "rec1",
      "category": "electronics",
      "score": 0.85,
      "title": "Related Product"
    }
  ],
  "cacheSource": "redis"
}
```

#### Manual Batch Computation (Admin Only)
```
POST /api/products/recommendations/batch
Headers: Authorization: Bearer <admin_token>
```

Response:
```json
{
  "status": "success",
  "message": "Batch computation started",
  "jobId": "batch-2026-04-06"
}
```

#### View Recommendation Stats
```
GET /api/products/recommendations/stats
```

Response:
```json
{
  "totalRecommendations": 32951,
  "cacheHitRate": 98.5,
  "avgResponseTime": "8ms",
  "lastBatchTime": "2026-04-06T02:00:00Z"
}
```

### Batch Job Configuration

The system runs a daily batch job at **2:00 AM** (configurable via `BATCH_CRON_SCHEDULE` in `.env`)

Edit `BATCH_CRON_SCHEDULE` for different times:
- `0 2 * * *` - Every day at 2 AM (default)
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Every Monday at 9 AM

### Recommendation Strategies

The system evaluates 4 ML strategies:

| Strategy | Accuracy | Use Case |
|----------|----------|----------|
| **Apriori Only** | 13% | "Customers also bought..." |
| **KNN Content-Based** | 3.6% | Similar products (weak) |
| **KNN Collaborative** | 13.4% | **RECOMMENDED** ← Best |
| **Full Hybrid** | 5.8% | Combined (underperforms) |

### Evaluation & Diagnostics

#### View Evaluation Results
```bash
cd integration/item-recommendation
cat models/evaluation_results.json
```

#### Run Diagnostic Analysis
```bash
source .venv/bin/activate
python diagnostic_low_precision.py
```

This generates:
- `diagnostic_results.json` - Detailed metrics
- `DIAGNOSTIC_FINDINGS.md` - Root cause analysis

#### Visualize Results
```bash
python visualize_results.py
```

### Performance Metrics

**Cache Layer Performance:**
- Redis hit: ~8ms
- MongoDB fallback: ~250ms
- On-demand computation: ~3-5s

**Recommendation Performance:**
- Precision@5: 13.4%
- Recall@5: 65%
- Mean Reciprocal Rank: 0.42

**System Constraints (OLIST Dataset):**
- Single-item baskets: 90.1%
- Total products: 32,951
- Categories: 73
- Transactions: 98,666

### Troubleshooting

**Redis Connection Failed**
```
⚠️  Warning: Redis connection failed
→ System falls back to MongoDB caching
→ Performance slightly degraded (but functional)
```

**Batch Job Not Running**
1. Check node-cron is initialized: `npm run server`
2. Verify MongoDB connection in `.env`
3. Check Python venv path in `.env`: `PYTHON_VENV_PATH`

**Low Recommendation Accuracy**
- Check `DIAGNOSTIC_FINDINGS.md` for dataset analysis
- System is working correctly; dataset has inherent low-pattern nature
- 13% accuracy is 6.7x better than random baseline

**Python Module Not Found**
```bash
cd integration/item-recommendation
source .venv/bin/activate
pip install -r pyproject.toml
```

---
