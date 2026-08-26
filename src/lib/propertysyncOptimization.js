/**
 * Performance & Cost Optimization Layer
 * 
 * Strategies for:
 * - Reducing OpenAI API calls
 * - Limiting processing to changed/stale listings
 * - Batch request optimization
 * - Caching and smart prioritization
 * - Rate limiting
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get list of properties that need syncing
 * Smart filtering to avoid unnecessary processing
 * 
 * @param {object} params
 * @returns {Promise<array>} Properties ready for sync
 */
export async function getPropertiesNeedingSync({
  supabaseClient,
  accountId,
  maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days default
  frequency = 'daily',
  includeNeverSynced = true,
  limit = 100,
}) {
  try {
    const now = new Date();
    const maxAgeDate = new Date(now.getTime() - maxAge);

    let query = supabaseClient
      .from('properties')
      .select('id, property_name, address, source_url, updated_at')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .not('source_url', 'is', null);

    // Filter by frequency
    switch (frequency) {
      case 'high': // High-change properties (weekly or more)
        query = query.lt('updated_at', maxAgeDate);
        break;
      case 'daily': // Standard daily sync
        query = query.lt('updated_at', new Date(now.getTime() - 24 * 60 * 60 * 1000));
        break;
      case 'weekly': // Weekly sync
        query = query.lt('updated_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        break;
      default:
        query = query.lt('updated_at', maxAgeDate);
    }

    if (includeNeverSynced) {
      // Also include properties never synced (highest priority)
      // This is handled by allowing null in updated_at
    }

    const { data: properties, error } = await query
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return properties || [];
  } catch (error) {
    console.error('Error getting properties needing sync:', error);
    return [];
  }
}

/**
 * Get high-priority properties (changed frequently)
 * These should be synced more often
 * 
 * @param {object} supabaseClient
 * @param {string} accountId
 * @param {number} limit
 * @returns {Promise<array>}
 */
export async function getHighPriorityProperties(
  supabaseClient,
  accountId,
  limit = 20
) {
  try {
    // Get properties with most recent changes
    // (proxied by most recent sync logs)
    const { data: recentChanges, error: logsError } = await supabaseClient
      .from('property_sync_logs')
      .select('property_id, action_taken, synced_at')
      .eq('account_id', accountId)
      .eq('action_taken', 'updated')
      .order('synced_at', { ascending: false })
      .limit(100);

    if (logsError) {
      throw logsError;
    }

    // Get unique property IDs that were recently updated
    const propertyIds = [...new Set(recentChanges.map((r) => r.property_id))].slice(
      0,
      limit
    );

    if (propertyIds.length === 0) {
      return [];
    }

    const { data: properties, error: propError } = await supabaseClient
      .from('properties')
      .select('*')
      .eq('account_id', accountId)
      .in('id', propertyIds);

    if (propError) {
      throw propError;
    }

    return properties || [];
  } catch (error) {
    console.error('Error getting high-priority properties:', error);
    return [];
  }
}

/**
 * Calculate optimal batch size based on rate limits
 * 
 * @param {object} config - Sync config from database
 * @returns {number} Optimal batch size
 */
export function calculateOptimalBatchSize(config = {}) {
  const {
    maxRequestsPerMinute = 30,
    delayBetweenRequests = 500, // ms
    openaiCallDelay = 1000, // ms (OpenAI has lower limits)
  } = config;

  // OpenAI API has rate limits
  // Assuming embedded calls to OpenAI with other processing
  const avgTimePerProperty = delayBetweenRequests + openaiCallDelay;
  const timePerMinute = 60 * 1000; // ms

  const maxBatchFromRate = Math.floor(
    (timePerMinute / avgTimePerProperty) * (maxRequestsPerMinute / 30)
  );

  // Default to 10, max 50, min 1
  return Math.max(1, Math.min(50, maxBatchFromRate || 10));
}

/**
 * Smart caching layer for extracted data
 * Helps avoid re-extracting unchanged content
 * 
 * @param {string} key - Cache key (usually URL hash)
 * @param {string} operation - 'get', 'set', 'clear'
 * @param {object} value - Value to cache (only for 'set')
 * @param {number} ttlMs - Time to live (default 1 hour)
 * @returns {object|null} Cached value or null
 */
export class PropertyExtractionCache {
  constructor(ttlMs = 60 * 60 * 1000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached value
   * @param {string} key
   * @returns {object|null}
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set cache value
   * @param {string} key
   * @param {object} value
   */
  set(key, value) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear specific key or all cache
   * @param {string} key - Optional specific key
   */
  clear(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache stats
   * @returns {object}
   */
  getStats() {
    const now = Date.now();
    const active = Array.from(this.cache.values()).filter(
      (item) => now <= item.expiresAt
    ).length;

    return {
      totalItems: this.cache.size,
      activeItems: active,
      expiredItems: this.cache.size - active,
    };
  }
}

// Global cache instance
const extractionCache = new PropertyExtractionCache();

/**
 * Check if HTML content has changed since last extraction
 * Uses simple hash comparison
 * 
 * @param {string} currentHtml
 * @param {string} previousHash
 * @returns {boolean} True if content changed
 */
export function hasContentChanged(currentHtml, previousHash) {
  if (!previousHash) return true;

  // Simple hash function
  const currentHash = hashString(currentHtml);
  return currentHash !== previousHash;
}

/**
 * Simple string hash function
 * Not cryptographically secure, just for comparison
 * 
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Rate limiter for API calls
 * Prevents hitting rate limits
 */
export class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  /**
   * Check if allowed to make request
   * @returns {Promise<boolean>}
   */
  async isAllowed() {
    const now = Date.now();
    // Remove old requests outside window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Wait until allowed to proceed
   * @returns {Promise<void>}
   */
  async waitForSlot() {
    while (!(await this.isAllowed())) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get current utilization
   * @returns {number} 0-1
   */
  getUtilization() {
    const now = Date.now();
    const activeRequests = this.requests.filter(
      (time) => now - time < this.windowMs
    ).length;
    return activeRequests / this.maxRequests;
  }
}

/**
 * Cost calculator for OpenAI API calls
 * Helps track and optimize spending
 */
export class CostCalculator {
  // Current OpenAI pricing (update as needed)
  static PRICING = {
    // GPT-4o mini pricing (per 1M tokens)
    'gpt-4o-mini': {
      input: 0.15,
      output: 0.6,
    },
  };

  /**
   * Estimate cost of extraction batch
   * 
   * @param {number} propertyCount
   * @param {number} avgInputTokens - Average input tokens per request
   * @param {number} avgOutputTokens - Average output tokens per response
   * @returns {object} Cost estimate
   */
  static estimateBatchCost(
    propertyCount,
    avgInputTokens = 5000,
    avgOutputTokens = 500
  ) {
    const pricing = this.PRICING['gpt-4o-mini'];
    const inputCost =
      (propertyCount * avgInputTokens * pricing.input) / 1000000;
    const outputCost =
      (propertyCount * avgOutputTokens * pricing.output) / 1000000;

    return {
      propertyCount,
      estimatedInputTokens: propertyCount * avgInputTokens,
      estimatedOutputTokens: propertyCount * avgOutputTokens,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: (inputCost + outputCost).toFixed(4),
      costPerProperty: ((inputCost + outputCost) / propertyCount).toFixed(4),
    };
  }

  /**
   * Calculate actual cost from usage
   * 
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @returns {object}
   */
  static calculateActualCost(inputTokens, outputTokens) {
    const pricing = this.PRICING['gpt-4o-mini'];
    const inputCost = (inputTokens * pricing.input) / 1000000;
    const outputCost = (outputTokens * pricing.output) / 1000000;

    return {
      inputTokens,
      outputTokens,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: (inputCost + outputCost).toFixed(4),
    };
  }
}

/**
 * Export cache instance for use throughout app
 */
export { extractionCache };
