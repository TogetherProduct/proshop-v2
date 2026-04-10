import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Recommendation from '../models/recommendationModel.js';
import { setCache, clearRecommendationCache } from '../utils/redisClient.js';
import { AppDataSource } from '../config/sqliteDb.js';
import SqlProduct from '../models/productSQLModel.js';
import { In } from 'typeorm';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse Python recommender output
 * Same format as recommendationController
 */
const parseRecommenderOutput = (output) => {
  const recommendations = [];
  const lines = output.split('\n');

  let inRecommendationsSection = false;
  let currentRec = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Top') && line.includes('recommendations')) {
      inRecommendationsSection = true;
      continue;
    }

    if (!inRecommendationsSection) continue;

    const productMatch = line.match(/Product:\s+([a-f0-9]{32})/);
    if (productMatch) {
      if (currentRec) {
        recommendations.push(currentRec);
      }
      currentRec = {
        productId: productMatch[1],
        score: 0,
        method: '',
      };
      continue;
    }

    if (!currentRec) continue;

    const scoreMatch = line.match(/Score:\s+([\d.]+)/);
    if (scoreMatch) {
      currentRec.score = parseFloat(scoreMatch[1]);
      continue;
    }

    const methodMatch = line.match(/Method:\s+(.*)/);
    if (methodMatch) {
      currentRec.method = methodMatch[1].trim();
      continue;
    }
  }

  if (currentRec) {
    recommendations.push(currentRec);
  }

  return recommendations;
};

/**
 * Call Python recommender service for a single product
 */
const callRecommenderService = async (productId, k = 10) => {
  return new Promise((resolve, reject) => {
    const recomPath = path.join(
      __dirname,
      '../../integration/item-recommendation'
    );

    //const pythonExe = path.join(recomPath, '.venv', 'bin', 'python3');
    //const pythonExe = "integration/item-recommendation/.venv/Scripts/python.exe"

    const pythonExe = os.platform() === 'win32' ? path.join(recomPath, '.venv', 'Scripts', 'python.exe') : path.join(recomPath, '.venv', 'bin', 'python3');

    const python = spawn(pythonExe, [
      path.join(recomPath, 'main.py'),
      'recommend',
      '--product-id',
      productId,
      '--k',
      String(k),
      '--models-dir',
      path.join(recomPath, 'models'),
    ]);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Recommender error:', errorOutput);
        reject(new Error(`Recommender failed with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const recommendations = parseRecommenderOutput(output);
        resolve(recommendations);
      } catch (err) {
        console.error('Parse error:', err);
        reject(err);
      }
    });

    python.on('error', (err) => {
      console.error('Spawn error:', err);
      reject(err);
    });
  });
};

/**
 * Enrich recommendations with product details
 */
const enrichRecommendationsWithProducts = async (recommendations) => {
  try {
    if (!recommendations || recommendations.length === 0) {
      return recommendations;
    }

    const productIds = recommendations.map((rec) => rec.productId);
    const sqlProductRepository = AppDataSource.getRepository(SqlProduct);
    const sqlProducts = await sqlProductRepository.find({
      where: {
        product_id: In(productIds),
      },
    });

    const productMap = {};
    sqlProducts.forEach((product) => {
      productMap[product.product_id] = product;
    });

    const enriched = recommendations.map((rec) => {
      const product = productMap[rec.productId];

      return {
        ...rec,
        productDetails: {
          product_name: product?.product_name || 'Product Not Found',
          product_category_name: product?.product_category_name || 'Unknown',
          price: product?.price || 0,
          image_url: product?.image_url || '/images/sample.jpg',
          rating: 0,
        },
      };
    });

    return enriched;
  } catch (error) {
    console.error('Error enriching recommendations:', error);
    return recommendations;
  }
};

/**
 * Batch compute all recommendations for all products
 * This is the main batch job that should run offline (e.g., 2 AM daily)
 */
const batchComputeAllRecommendations = async (options = {}) => {
  const {
    k = 10,
    batchSize = 50,
    skipCache = false,
    saveToDB = true,
    saveToRedis = true,
  } = options;

  console.log('\n========================================');
  console.log('🚀 BATCH RECOMMENDER COMPUTATION STARTED');
  console.log('========================================');
  const startTime = Date.now();

  try {
    // Clear old cache if requested
    if (skipCache) {
      console.log('\n🗑️  Clearing old recommendation cache...');
      await clearRecommendationCache();
      await Recommendation.deleteMany({});
    }

    // Get all products
    console.log('\n📦 Fetching all products...');
    const sqlProductRepository = AppDataSource.getRepository(SqlProduct);
    const products = await sqlProductRepository.find({
      select: ['product_id', 'product_name'],
    });

    console.log(`✅ Found ${products.length} products`);

    if (products.length === 0) {
      console.log('⚠️  No products found. Exiting.');
      return {
        success: false,
        message: 'No products found',
        totalProcessed: 0,
      };
    }

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Process products in batches to avoid overwhelming Python process
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(products.length / batchSize);

      console.log(
        `\n📊 Processing batch ${batchNum}/${totalBatches} (${batch.length} products)...`
      );

      for (let j = 0; j < batch.length; j++) {
        const product = batch[j];
        const progress = `${i + j + 1}/${products.length}`;

        try {
          // Get recommendations for this product
          const recommendations = await callRecommenderService(
            product.product_id,
            k
          );

          // Enrich with product details
          const enrichedRecs = await enrichRecommendationsWithProducts(
            recommendations
          );

          // Save to MongoDB
          if (saveToDB) {
            await Recommendation.updateOne(
              { productId: product.product_id },
              {
                $set: {
                  productId: product.product_id,
                  recommendations: enrichedRecs,
                  cachedAt: new Date(),
                  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              },
              { upsert: true }
            );
          }

          // Save to Redis
          if (saveToRedis) {
            const cacheKey = `rec:${product.product_id}`;
            await setCache(cacheKey, enrichedRecs, 86400); // 24h TTL
          }

          results.push({
            productId: product.product_id,
            success: true,
            count: recommendations.length,
          });

          successCount++;
          console.log(
            `  ✅ [${progress}] ${product.product_name} → ${recommendations.length} recommendations`
          );
        } catch (error) {
          errorCount++;
          console.error(
            `  ❌ [${progress}] ${product.product_name} → Error: ${error.message}`
          );
          results.push({
            productId: product.product_id,
            success: false,
            error: error.message,
          });
        }
      }

      // Brief pause between batches to avoid resource exhaustion
      if (i + batchSize < products.length) {
        console.log('⏳ Waiting before next batch...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n========================================');
    console.log('📈 BATCH COMPUTATION COMPLETED');
    console.log('========================================');
    console.log(`✅ Success: ${successCount}/${products.length}`);
    console.log(`❌ Errors: ${errorCount}/${products.length}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Avg per product: ${(parseInt(duration) / products.length).toFixed(2)}s`);
    console.log('========================================\n');

    return {
      success: true,
      totalProducts: products.length,
      successCount,
      errorCount,
      duration: `${duration}s`,
      results: results.filter((r) => !r.success), // Return only errors
    };
  } catch (error) {
    console.error('❌ BATCH JOB ERROR:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Batch compute recommendations for specific products
 * Useful for computing recommendations for new products
 */
const batchComputeSpecificProducts = async (productIds, k = 10) => {
  console.log(
    `\n🚀 Computing recommendations for ${productIds.length} specific product(s)...`
  );

  const results = [];

  for (const productId of productIds) {
    try {
      const recommendations = await callRecommenderService(productId, k);
      const enrichedRecs = await enrichRecommendationsWithProducts(
        recommendations
      );

      // Save to MongoDB
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

      // Save to Redis
      const cacheKey = `rec:${productId}`;
      await setCache(cacheKey, enrichedRecs, 86400);

      results.push({
        productId,
        success: true,
        count: recommendations.length,
      });

      console.log(`✅ ${productId} → ${recommendations.length} recommendations`);
    } catch (error) {
      results.push({
        productId,
        success: false,
        error: error.message,
      });
      console.error(`❌ ${productId} → Error: ${error.message}`);
    }
  }

  return {
    success: true,
    totalProcessed: productIds.length,
    results,
  };
};

export {
  batchComputeAllRecommendations,
  batchComputeSpecificProducts,
  callRecommenderService,
  enrichRecommendationsWithProducts,
};
