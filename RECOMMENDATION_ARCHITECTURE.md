# Recommendation Engine - Hybrid Batch Processing Architecture

## 📋 Overview

Restructured recommendation engine implementing **production-grade batch pre-computation** approach instead of on-demand computation. This ensures:

- ✅ **Predictable Response Time**: <20ms API responses
- ✅ **Efficient Resource Usage**: Single computation per product daily
- ✅ **Scalable Architecture**: Handles millions of products efficiently
- ✅ **Enterprise-Ready**: Follows e-commerce platform best practices (Amazon, Alibaba, Shopee)

---

## 🏗️ Architecture

### Three-Layer Caching System

```
Frontend Request
    ↓
┌──────────────────────────────────┐
│ LEVEL 1: Redis Cache (Ultra-Fast)│  ← <10ms response time
│ - In-memory, TTL: 24 hours       │
│ - Warm cache for hot products    │
└──────────────┬───────────────────┘
               │ (Cache Miss)
               ↓
┌──────────────────────────────────┐
│ LEVEL 2: MongoDB Cache (Fallback)│  ← 100-500ms response time
│ - Persistent, TTL: 30 days       │
│ - Recovers Redis cache           │
└──────────────┬───────────────────┘
               │ (Cache Miss)
               ↓
┌──────────────────────────────────┐
│ LEVEL 3: On-Demand Computation   │  ← 2-5s response time
│ - For new/uncached products      │
│ - Automatic cache population     │
└──────────────────────────────────┘
```

### Batch Processing Pipeline

```
┌─────────────────────────────────────┐
│ Scheduler (node-cron)               │
│ Default: 2 AM daily                 │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ Batch Recommendation Job                        │
│ 1. Fetch all ~100 products                      │
│ 2. Process in batches (to avoid memory issues)  │
│ 3. Call Python ML pipeline for each             │
│ 4. Enrich with product details                  │
│ 5. Store in MongoDB + Redis                     │
└─────────────────────────────────────────────────┘
             │
             ▼ (Cache Ready)
┌─────────────────────────────────────┐
│ Redis: ALL products cached          │
│ MongoDB: ALL products cached        │
│ API Response: INSTANT (<20ms)       │
└─────────────────────────────────────┘
```

---

## 📦 New Files & Modules

### 1. **Redis Utility** (`backend/utils/redisClient.js`)
- Manages Redis connection and caching operations
- Methods:
  - `initRedis()` - Initialize Redis connection
  - `getCache(key)` - Retrieve cached recommendations
  - `setCache(key, value, ttl)` - Cache recommendations
  - `deleteCache(key)` - Clear specific cache
  - `clearRecommendationCache()` - Bulk clear all rec caches

### 2. **Batch Job** (`backend/jobs/batchRecommendations.js`)
- Main batch computation logic
- Key functions:
  - `batchComputeAllRecommendations()` - Compute for all products
  - `batchComputeSpecificProducts()` - Compute for specific products
  - `callRecommenderService()` - Call Python ML service
  - `enrichRecommendationsWithProducts()` - Add product details

### 3. **Scheduler** (`backend/config/scheduler.js`)
- Node-cron based scheduling
- Functions:
  - `initScheduler()` - Start daily schedule
  - `manuallyTriggerBatch()` - Trigger via API
  - `stopScheduler()` - Graceful shutdown

### 4. **Updated Controller** (`backend/controllers/recommendationController.js`)
- **`getRecommendations()`** - Three-layer cache lookup
- **`clearRecommendationCache()`** - Clear MongoDB + Redis cache
- **`batchGenerateRecommendations()`** - Manual batch trigger endpoint
- **`getRecommendationStats()`** - View cache statistics

### 5. **Updated Routes** (`backend/routes/productRoutes.js`)
New endpoints:
```javascript
GET  /api/products/recommendations/stats    // View cache stats
POST /api/products/recommendations/batch    // Trigger batch (admin)
GET  /api/products/:id/recommendations      // Get recommendations
DEL  /api/products/:id/recommendations      // Clear cache (admin)
```

### 6. **Updated Server** (`backend/server.js`)
- Initialize Redis on startup
- Initialize scheduler on startup
- Graceful shutdown handlers

---

## 🚀 Getting Started

### Step 1: Install Dependencies
```bash
npm install
```

New packages added:
- `redis@^4.6.7` - Redis client
- `node-cron@^3.0.2` - Cron scheduler

### Step 2: Setup Redis

**Option A: Local Redis (Development)**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

**Option B: Cloud Redis (Production)**
- AWS ElastiCache
- Google Cloud Memorystore
- Redis Cloud (redis.com)

### Step 3: Configure Environment Variables

Add to your `.env` file:
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty for local/unsecured

# Batch Scheduling (optional)
BATCH_CRON_SCHEDULE=0 2 * * *      # 2 AM daily
BATCH_SIZE=50                       # Products per batch
```

### Step 4: Start Server

```bash
npm run server
```

You should see:
```
📦 Initializing Redis...
✅ Redis connected
🕐 SCHEDULER INITIALIZATION
   Cron expression: 0 2 * * *
✅ Scheduler initialized
✅ Server and dependencies initialized
```

---

## 📝 API Usage Examples

### 1. Get Recommendations for a Product
```bash
curl http://localhost:5000/api/products/507f1f77bcf86cd799439011/recommendations?k=10

Response:
{
  "recommendations": [
    {
      "productId": "...",
      "score": 0.95,
      "method": "Apriori Rules",
      "productDetails": {
        "product_name": "...",
        "product_category_name": "...",
        "price": 199.99,
        "image_url": "..."
      }
    }
  ],
  "source": "redis",     // or "mongodb", "computed"
  "cached": true,
  "cacheType": "redis"   // or "mongodb"
}
```

### 2. Manually Trigger Batch Computation
```bash
curl -X POST http://localhost:5000/api/products/recommendations/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "skipCache": false,
    "batchSize": 50
  }'

Response:
{
  "message": "Batch recommendation generation started (running in background)",
  "status": "started",
  "skipCache": false,
  "batchSize": 50
}
```

### 3. View Cache Statistics
```bash
curl http://localhost:5000/api/products/recommendations/stats

Response:
{
  "mongoDb": {
    "cachedProducts": 100,
    "avgRecommendationsPerProduct": 10,
    "totalRecommendationsStored": 1000
  }
}
```

### 4. Clear Cache for Specific Product
```bash
curl -X DELETE http://localhost:5000/api/products/507f1f77bcf86cd799439011/recommendations \
  -H "Authorization: Bearer <admin_token>"

Response:
{
  "message": "Recommendation cache cleared (MongoDB + Redis)",
  "productId": "507f1f77bcf86cd799439011"
}
```

---

## 🔧 Configuration Guide

### Cron Schedule Examples

```env
# Every day at 2 AM (default)
BATCH_CRON_SCHEDULE=0 2 * * *

# Every Sunday at 3 AM
BATCH_CRON_SCHEDULE=0 3 * * 0

# Every 6 hours
BATCH_CRON_SCHEDULE=0 */6 * * *

# Every day at 12:30 AM
BATCH_CRON_SCHEDULE=30 0 * * *

# Multiple times: 2 AM, 2 PM (use separate cron jobs)
```

Cron Format: `minute hour day month dayOfWeek`

### Batch Size Configuration

```env
# Small (10-50): Low memory, slower, suitable for dev
BATCH_SIZE=10

# Medium (50-100): Balanced (recommended)
BATCH_SIZE=50

# Large (100+): Fast but high memory usage (production)
BATCH_SIZE=100
```

---

## 📊 Workflow Diagram

### First-Time User Flow
```
User clicks product A
    ↓
API receives: GET /products/A/recommendations
    ↓
Check Redis → Not found (first time)
    ↓
Check MongoDB → Not found (first time)
    ↓
Compute on-demand (2-5s)
    ↓
Cache in MongoDB + Redis
    ↓
Return recommendations (NOW in cache)
    ↓
Next user → INSTANT <20ms response
```

### After Batch Job Runs
```
2 AM → Batch job triggers
    ↓
Fetch all 100+ products
    ↓
For each product:
  Compute recommendations → Cache in MongoDB + Redis
    ↓
After batch completes:
  ALL products have precomputed cache
  ANY user request = INSTANT <20ms
```

---

## 🔍 Monitoring & Debugging

### View Batch Job Logs

The batch job logs will appear in console when:
1. Scheduled time arrives (2 AM)
2. Manually triggered via API

Example output:
```
========================================
🚀 BATCH RECOMMENDER COMPUTATION STARTED
========================================
📦 Fetching all products...
✅ Found 103 products

📊 Processing batch 1/3 (50 products)...
  ✅ [1/103] Product A → 10 recommendations
  ✅ [2/103] Product B → 9 recommendations
  ...

========================================
📈 BATCH COMPUTATION COMPLETED
========================================
✅ Success: 103/103
❌ Errors: 0/103
⏱️  Duration: 125.45s
📊 Avg per product: 1.22s
========================================
```

### Check Cache Health

```bash
# View MongoDB cache count
curl http://localhost:5000/api/products/recommendations/stats

# Monitor Redis (if you're a developer)
redis-cli
> KEYS rec:*
> GET rec:<product_id>
```

---

## 🚨 Troubleshooting

### Issue: "Redis connection failed"
```
❌ Redis init error: Connection refused
⚠️  Continuing without Redis (cache will be disabled)
```
**Solution**: Start Redis server
```bash
redis-server
# or if using Docker
docker run -d -p 6379:6379 redis:latest
```

### Issue: "Batch job not running"
```
⏰ Scheduled batch recommendation job triggered!
❌ Batch job error: ...
```
**Solution**:
1. Check logs for specific error
2. Ensure Python environment exists: `integration/item-recommendation/.venv`
3. Verify training models exist in `integration/item-recommendation/models`

### Issue: Slow API response for new products
This is expected! First request for a new product will take 2-5s as it computes on-demand. Subsequent requests within 24h are instant (<20ms).

**Solution**: Run batch job manually after uploading new products:
```bash
curl -X POST http://localhost:5000/api/products/recommendations/batch \
  -H "Authorization: Bearer <admin_token>"
```

---

## 📈 Performance Comparison

| Metric | Before | After |
|--------|--------|-------|
| **First Request** | 2-5s | 2-5s (first time) then <20ms |
| **Subsequent Requests** | Variable (cache miss risk) | <20ms (guaranteed cache) |
| **Server CPU Load** | Spiky (computation on request) | Even (scheduled batch) |
| **Concurrent Users** | Degrades quickly | Stable |
| **Daily Computation** | Up to 10,000x | 1x |

---

## 🎯 Next Steps

1. **Setup Redis locally** for development
2. **Test API endpoints** using provided curl examples
3. **Configure cron schedule** for your use case
4. **Monitor batch job** performance
5. **Scale to production** using cloud Redis service

---

## 🛠️ Advanced Topics

### Custom Batch Schedule
To change batch time, modify `.env`:
```env
# Run at 3 AM
BATCH_CRON_SCHEDULE=0 3 * * *
```
Restart server to apply changes.

### Parallel Product Processing
Modify `batchComputeAllRecommendations()` batch size:
```env
BATCH_SIZE=100  # Process 100 products concurrently
```

### New Product Handling
When new product uploaded:
1. It will be included in next scheduled batch
2. OR trigger manual batch: `POST /api/products/recommendations/batch`
3. OR access it will trigger on-demand computation

---

## 📞 Support

For issues with:
- **Redis**: Check Redis server is running
- **Batch computations**: Check Python venv and trained models
- **Scheduler**: Check cron expression syntax
- **API Endpoints**: Check admin authentication token

