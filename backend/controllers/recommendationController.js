import asyncHandler from '../middleware/asyncHandler.js';
import Recommendation from '../models/recommendationModel.js';
import Product from '../models/productModel.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppDataSource } from '../config/sqliteDb.js';
import SqlProduct from '../models/productSQLModel.js';
import { In } from 'typeorm';
import { getCache, setCache, deleteCache } from '../utils/redisClient.js';
import {
  callRecommenderService,
  enrichRecommendationsWithProducts,
} from '../jobs/batchRecommendations.js';
import { manuallyTriggerBatch } from '../config/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get recommendations for a product
// @route   GET /api/products/:id/recommendations
// @access  Public
const getRecommendations = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const { k = 10 } = req.query;
  try {
    const cacheKey = `rec:${productId}`;

    // ===== LEVEL 1: Check Redis Cache (fastest) =====
    console.log(`[L1] Checking Redis cache for ${productId}...`);
    let cachedRec = await getCache(cacheKey);

    if (cachedRec && Array.isArray(cachedRec) && cachedRec.length > 0) {
      console.log(`✅ Redis cache HIT for ${productId}`);
      const recs = cachedRec.slice(0, k);
      return res.json({
        recommendations: recs,
        source: 'redis',
        cached: true,
        cacheType: 'redis',
      });
    }

    // ===== LEVEL 2: Check MongoDB Cache (slower but persistent) =====
    console.log(`[L2] Checking MongoDB cache for ${productId}...`);
    const mongoRec = await Recommendation.findOne({ productId });

    if (mongoRec && mongoRec.recommendations.length > 0) {
      console.log(`✅ MongoDB cache HIT for ${productId}`);
      const recs = mongoRec.recommendations.slice(0, k);

      // Warm up Redis from MongoDB
      await setCache(cacheKey, mongoRec.recommendations, 86400);

      return res.json({
        recommendations: recs,
        source: 'mongodb',
        cached: true,
        cacheType: 'mongodb',
      });
    }

    // ===== LEVEL 3: On-Demand Computation (Fallback) =====
    // This happens when:
    // 1. Product is brand new (not in batch yet)
    // 2. Cache expired (rare with 24h Redis TTL + MongoDB)
    console.log(`[L3] Cache MISS - Computing on-demand for ${productId}...`);

    const recommendations = await callRecommenderService(productId, k);

    if (recommendations && recommendations.length > 0) {
      // Enrich with product details
      const enrichedRecs = await enrichRecommendationsWithProducts(
        recommendations
      );

      // Save to MongoDB for persistence
      await Recommendation.updateOne(
        { productId },
        {
          $set: {
            productId,
            recommendations: enrichedRecs,
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        { upsert: true }
      );

      // Save to Redis for fast access
      await setCache(cacheKey, enrichedRecs, 86400);

      console.log(
        `✅ On-demand computation successful, cached ${enrichedRecs.length} recommendations`
      );

      return res.json({
        recommendations: enrichedRecs.slice(0, k),
        source: 'computed',
        cached: false,
      });
    }

    // No recommendations found
    console.log(`⚠️  No recommendations found for ${productId}`);
    return res.json({
      recommendations: [],
      source: 'none',
      cached: false,
      message: 'No recommendations available',
    });
  } catch (error) {
    console.error('❌ Recommendation error:', error);
    // Return empty instead of error to not break product page
    res.json({
      recommendations: [],
      source: 'error',
      cached: false,
      error: error.message,
    });
  }
});

// @desc    Clear recommendation cache for a product
// @route   DELETE /api/recommendations/:productId
// @access  Private/Admin
const clearRecommendationCache = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  try {
    // Delete from MongoDB
    const mongoResult = await Recommendation.deleteOne({ productId });

    // Delete from Redis
    const cacheKey = `rec:${productId}`;
    await deleteCache(cacheKey);

    if (mongoResult.deletedCount > 0) {
      console.log(
        `✅ Cache cleared for ${productId} (MongoDB + Redis)`
      );
      res.json({
        message: 'Recommendation cache cleared (MongoDB + Redis)',
        productId,
      });
    } else {
      console.log(`⚠️  Cache not found for ${productId}`);
      res.status(404);
      throw new Error('Recommendation cache not found');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(error.statusCode || 500);
    throw error;
  }
});

// @desc    Manually trigger batch recommendation generation
// @route   POST /api/recommendations/batch
// @access  Private/Admin
const batchGenerateRecommendations = asyncHandler(async (req, res) => {
  const { skipCache = false, batchSize = 50 } = req.body;

  console.log('📤 Batch generation requested from API');

  // Run batch in background (non-blocking)
  manuallyTriggerBatch({
    skipCache,
    batchSize,
    saveToDB: true,
    saveToRedis: true,
  })
    .then((result) => {
      console.log('✅ Batch generation completed:', result);
    })
    .catch((error) => {
      console.error('❌ Batch generation error:', error);
    });

  // Return immediately with status
  res.json({
    message: 'Batch recommendation generation started (running in background)',
    status: 'started',
    skipCache,
    batchSize,
  });
});

// @desc    Get batch status and recommendations cache info
// @route   GET /api/recommendations/stats
// @access  Public
const getRecommendationStats = asyncHandler(async (req, res) => {
  try {
    const mongoCount = await Recommendation.countDocuments();
    const mongoData = await Recommendation.aggregate([
      {
        $group: {
          _id: null,
          avgRecommendations: { $avg: { $size: '$recommendations' } },
          totalRecommendations: { $sum: { $size: '$recommendations' } },
        },
      },
    ]);

    res.json({
      mongoDb: {
        cachedProducts: mongoCount,
        avgRecommendationsPerProduct:
          mongoData[0]?.avgRecommendations || 0,
        totalRecommendationsStored:
          mongoData[0]?.totalRecommendations || 0,
      },
      note: 'Redis stats available if Redis is connected',
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500);
    throw error;
  }
});

export {
  getRecommendations,
  clearRecommendationCache,
  batchGenerateRecommendations,
  getRecommendationStats,
};
