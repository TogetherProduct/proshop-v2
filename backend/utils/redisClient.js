import { createClient } from 'redis';

let redisClient = null;

/**
 * Initialize Redis client
 * @returns {Promise<void>}
 */
const initRedis = async () => {
  try {
    redisClient = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis init error:', error.message);
    console.warn('⚠️  Continuing without Redis (cache will be disabled)');
    return null;
  }
};

/**
 * Get Redis client
 * @returns {Object} Redis client or null if not connected
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Set value in Redis with expiration
 * @param {string} key
 * @param {*} value
 * @param {number} expirationSeconds - TTL in seconds (default: 24h)
 * @returns {Promise<boolean>}
 */
const setCache = async (key, value, expirationSeconds = 86400) => {
  try {
    if (!redisClient) return false;

    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await redisClient.setEx(key, expirationSeconds, jsonValue);
    console.log(`[Cache SET] ${key} (TTL: ${expirationSeconds}s)`);
    return true;
  } catch (error) {
    console.error(`[Cache SET Error] ${key}:`, error.message);
    return false;
  }
};

/**
 * Get value from Redis
 * @param {string} key
 * @returns {Promise<*>}
 */
const getCache = async (key) => {
  try {
    if (!redisClient) return null;

    const value = await redisClient.get(key);
    if (value) {
      console.log(`[Cache HIT] ${key}`);
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } else {
      console.log(`[Cache MISS] ${key}`);
      return null;
    }
  } catch (error) {
    console.error(`[Cache GET Error] ${key}:`, error.message);
    return null;
  }
};

/**
 * Delete key from Redis
 * @param {string} key
 * @returns {Promise<boolean>}
 */
const deleteCache = async (key) => {
  try {
    if (!redisClient) return false;

    const result = await redisClient.del(key);
    if (result > 0) {
      console.log(`[Cache DELETE] ${key}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[Cache DELETE Error] ${key}:`, error.message);
    return false;
  }
};

/**
 * Clear all cache for recommendations
 * @returns {Promise<void>}
 */
const clearRecommendationCache = async () => {
  try {
    if (!redisClient) return;

    const pattern = 'rec:*';
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[Cache CLEAR] Deleted ${keys.length} recommendation keys`);
    }
  } catch (error) {
    console.error('[Cache CLEAR Error]:', error.message);
  }
};

/**
 * Get cache statistics
 * @returns {Promise<Object>}
 */
const getCacheStats = async () => {
  try {
    if (!redisClient) {
      return { status: 'disconnected', keys: 0 };
    }

    const keys = await redisClient.keys('rec:*');
    const info = await redisClient.info('stats');
    
    return {
      status: 'connected',
      recommendationCacheCount: keys.length,
      info,
    };
  } catch (error) {
    console.error('[Cache STATS Error]:', error.message);
    return { status: 'error', error: error.message };
  }
};

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
const closeRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
      redisClient = null;
    }
  } catch (error) {
    console.error('❌ Error closing Redis:', error.message);
  }
};

export {
  initRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  clearRecommendationCache,
  getCacheStats,
  closeRedis,
};
