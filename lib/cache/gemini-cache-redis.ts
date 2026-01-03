import { Redis } from '@upstash/redis';
import { DashboardData } from '../types/indicators';
import { MarketPrediction } from '../api/gemini';
import { DEFAULT_GEMINI_MODEL } from '../constants/gemini-models';

interface CachedPrediction {
  prediction: MarketPrediction;
  timestamp: number;
  dataHash: string;
}

interface ParsedHash {
  model: string;
  total: number;
  us: number;
  cn: number;
  jp: number;
  others: number;
  [key: string]: string | number; // Allow dynamic indexing
}

/* 
  K-Beauty Export Cache Keys
  Uses export figures (in Million USD) for hashing
*/

const CACHE_PREFIX = 'gemini:prediction:kbeauty:'; // Changed prefix to avoid conflicts
const FALLBACK_PREFIX = 'gemini:fallback:kbeauty:';
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Upstash Redis-based Gemini cache for K-Beauty Export Dashboard
 */
class GeminiCacheRedis {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  /**
   * Get cached prediction by data hash
   */
  async getPrediction(
    dashboardData: DashboardData,
    modelName: string
  ): Promise<MarketPrediction | null> {
    const hash = this.hashData(dashboardData, modelName);
    const key = `${CACHE_PREFIX}${hash}`;

    try {
      const cached = await this.redis.get<CachedPrediction>(key);

      if (!cached) {
        console.log('[GeminiCacheRedis] Cache miss:', hash);
        return null;
      }

      const age = Math.round((Date.now() - cached.timestamp) / 1000);
      console.log(`[GeminiCacheRedis] Cache hit: ${hash} (age: ${age}s)`);
      return cached.prediction;
    } catch (error) {
      console.error('[GeminiCacheRedis] Error getting prediction:', error);
      return null;
    }
  }

  /**
   * Store prediction in cache with TTL
   */
  async setPrediction(
    dashboardData: DashboardData,
    prediction: MarketPrediction,
    modelName: string
  ): Promise<void> {
    const hash = this.hashData(dashboardData, modelName);
    const key = `${CACHE_PREFIX}${hash}`;
    const fallbackKey = `${FALLBACK_PREFIX}${Date.now()}`;

    const cached: CachedPrediction = {
      prediction,
      timestamp: Date.now(),
      dataHash: hash,
    };

    try {
      // Store with hash key (for exact match)
      await this.redis.set(key, cached, { ex: TTL_SECONDS });

      // Also store with timestamp key (for fallback retrieval)
      await this.redis.set(fallbackKey, cached, { ex: TTL_SECONDS });

      console.log(`[GeminiCacheRedis] Cached prediction: ${hash}`);

      // Cleanup old fallback keys (keep last 10)
      await this.cleanupFallbackKeys();
    } catch (error) {
      console.error('[GeminiCacheRedis] Error setting prediction:', error);
    }
  }

  /**
   * Parse hash string back to numeric values
   */
  private parseHash(hash: string): ParsedHash {
    const parsed = JSON.parse(hash);
    return {
      model: parsed.model || DEFAULT_GEMINI_MODEL,
      total: parseFloat(parsed.total),
      us: parseFloat(parsed.us),
      cn: parseFloat(parsed.cn),
      jp: parseFloat(parsed.jp),
      others: parseFloat(parsed.others),
    };
  }

  /**
   * Calculate dynamic ranges (min-max) for each indicator across all cached predictions
   */
  private calculateDynamicRanges(
    allCachedPredictions: CachedPrediction[]
  ): Record<string, number> {
    const allValues = allCachedPredictions.map(p => this.parseHash(p.dataHash));
    const keys = ['total', 'us', 'cn', 'jp', 'others'];
    const ranges: Record<string, number> = {};

    for (const key of keys) {
      const values = allValues.map(v => v[key] as number);
      const min = Math.min(...values);
      const max = Math.max(...values);
      ranges[key] = max - min;
    }

    return ranges;
  }

  /**
   * Calculate similarity score using Hybrid Min-Max approach
   */
  private calculateSimilarityHybrid(
    currentData: DashboardData,
    cachedHash: string,
    dynamicRanges: Record<string, number>,
    modelName: string
  ): number {
    const current = this.parseHash(this.hashData(currentData, modelName));
    const cached = this.parseHash(cachedHash);

    // Minimum thresholds: 1% of reasonable export figures (Million USD)
    // E.g. Total export ~500M -> 5M threshold
    const minThresholds: Record<string, number> = {
      total: 5.0,
      us: 1.0,
      cn: 1.0,
      jp: 0.5,
      others: 2.0,
    };

    let sumSquaredDiffs = 0;
    const keys = Object.keys(minThresholds);

    for (const key of keys) {
      const effectiveRange = Math.max(
        dynamicRanges[key] || 0,
        minThresholds[key]
      );

      const diff = Math.abs((current[key] as number) - (cached[key] as number)) / effectiveRange;
      sumSquaredDiffs += diff * diff;
    }

    const distance = Math.sqrt(sumSquaredDiffs / keys.length);
    return Math.exp(-distance);
  }

  /**
   * Calculate recency score based on timestamp
   */
  private calculateRecencyScore(timestamp: number): number {
    const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
    const maxAgeHours = 24; // TTL duration
    return Math.max(0, 1 - (ageHours / maxAgeHours));
  }

  /**
   * Get best matching prediction based on similarity to current data
   */
  async getBestMatchingPrediction(
    currentData: DashboardData,
    modelName: string
  ): Promise<MarketPrediction | null> {
    try {
      const keys = await this.redis.keys(`${FALLBACK_PREFIX}*`);

      if (keys.length === 0) {
        console.log('[GeminiCacheRedis] No fallback predictions available');
        return null;
      }

      const keyPredictionPairs = await Promise.all(
        keys.map(async (key) => {
          const cached = await this.redis.get<CachedPrediction>(key);
          return { key, cached };
        })
      );

      const validPairs = keyPredictionPairs.filter(
        (pair): pair is { key: string; cached: CachedPrediction } => {
          if (pair.cached === null) return false;
          // Robust check for corrupt data from old version
          try {
            const parsed = JSON.parse(pair.cached.dataHash);
            if (!parsed.total) return false; // Filter out old financial data hashes
            return parsed.model === modelName;
          } catch (e) {
            return false;
          }
        }
      );

      if (validPairs.length === 0) return null;

      const validCachedPredictions = validPairs.map(p => p.cached);
      const dynamicRanges = this.calculateDynamicRanges(validCachedPredictions);

      const scoredPredictions = validPairs.map(({ key, cached }) => {
        const similarityScore = this.calculateSimilarityHybrid(
          currentData,
          cached.dataHash,
          dynamicRanges,
          modelName
        );
        const recencyScore = this.calculateRecencyScore(cached.timestamp);
        const finalScore = similarityScore * 0.9 + recencyScore * 0.1;

        return { key, cached, similarityScore, recencyScore, finalScore };
      });

      const best = scoredPredictions.reduce((prev, curr) =>
        curr.finalScore > prev.finalScore ? curr : prev
      );

      const age = Math.round((Date.now() - best.cached.timestamp) / 1000);
      console.log(
        `[GeminiCacheRedis] Best match found:`,
        `similarity=${best.similarityScore.toFixed(3)},`,
        `age=${age}s`
      );

      return best.cached.prediction;
    } catch (error) {
      console.error('[GeminiCacheRedis] Error getting best match:', error);
      return null;
    }
  }

  /**
   * Hash dashboard data for cache key
   * Uses Export Metric values
   */
  private hashData(data: DashboardData, modelName: string): string {
    const indicators = data.indicators;

    // Create a simplified object for hashing
    // We use toFixed(1) to avoid floating point precision causing cache misses
    const rounded = {
      model: modelName,
      total: indicators.totalExport.value.toFixed(1),
      us: indicators.usExport.value.toFixed(1),
      cn: indicators.cnExport.value.toFixed(1),
      jp: indicators.jpExport.value.toFixed(1),
      others: indicators.othersExport.value.toFixed(1),
    };

    return JSON.stringify(rounded);
  }

  /**
   * Cleanup old fallback keys (keep last 10)
   */
  private async cleanupFallbackKeys(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${FALLBACK_PREFIX}*`);

      if (keys.length <= 10) {
        return;
      }

      const sortedKeys = keys.sort((a, b) => {
        const tsA = parseInt(a.replace(FALLBACK_PREFIX, ''));
        const tsB = parseInt(b.replace(FALLBACK_PREFIX, ''));
        return tsA - tsB;
      });

      const toDelete = sortedKeys.slice(0, keys.length - 10);
      if (toDelete.length > 0) {
        await this.redis.del(...toDelete);
        console.log(`[GeminiCacheRedis] Cleaned up ${toDelete.length} old fallback keys`);
      }
    } catch (error) {
      console.error('[GeminiCacheRedis] Error cleaning up:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const allKeys = await this.redis.keys('gemini:*');
      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
        console.log(`[GeminiCacheRedis] Cleared ${allKeys.length} keys`);
      }
    } catch (error) {
      console.error('[GeminiCacheRedis] Error clearing cache:', error);
    }
  }
}

export const geminiCache = new GeminiCacheRedis();
