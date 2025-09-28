const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const setupRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client connection ended');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    
    logger.info('✅ Redis connected successfully');
    
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

const getRedisClient = () => redisClient;

// Cache utilities
const cache = {
  set: async (key, value, ttl = 3600) => {
    try {
      const serialized = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serialized);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },
  
  get: async (key) => {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },
  
  del: async (key) => {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  },
  
  exists: async (key) => {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },
  
  // Session management
  setSession: async (sessionId, sessionData, ttl = 86400) => {
    await cache.set(`session:${sessionId}`, sessionData, ttl);
  },
  
  getSession: async (sessionId) => {
    return await cache.get(`session:${sessionId}`);
  },
  
  deleteSession: async (sessionId) => {
    await cache.del(`session:${sessionId}`);
  },
  
  // Rate limiting
  checkRateLimit: async (key, limit, window) => {
    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, window);
      }
      return current <= limit;
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return true; // Allow on error
    }
  },
  
  // User data caching
  cacheUser: async (userId, userData, ttl = 1800) => {
    await cache.set(`user:${userId}`, userData, ttl);
  },
  
  getCachedUser: async (userId) => {
    return await cache.get(`user:${userId}`);
  },
  
  // Transaction caching
  cacheTransaction: async (txId, txData, ttl = 3600) => {
    await cache.set(`tx:${txId}`, txData, ttl);
  },
  
  getCachedTransaction: async (txId) => {
    return await cache.get(`tx:${txId}`);
  },
  
  // Market data caching
  cacheMarketData: async (symbol, data, ttl = 60) => {
    await cache.set(`market:${symbol}`, data, ttl);
  },
  
  getCachedMarketData: async (symbol) => {
    return await cache.get(`market:${symbol}`);
  }
};

module.exports = {
  setupRedis,
  getRedisClient,
  cache
};