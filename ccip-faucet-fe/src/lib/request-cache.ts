// Request caching and deduplication for RPC calls
// Phase 3B: Intelligent caching to prevent duplicate calls

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  isLoading: boolean
}

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>()
  private pendingRequests = new Map<string, PendingRequest<any>>()
  
  // Default cache duration: 30 seconds
  private defaultTTL = 30 * 1000

  /**
   * Generate cache key from function name and arguments
   */
  private generateKey(functionName: string, args: any[]): string {
    const argsStr = JSON.stringify(args, (key, value) => {
      // Handle BigInt serialization
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    })
    return `${functionName}:${argsStr}`
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  /**
   * Set data in cache
   */
  private setCachedData<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      isLoading: false
    })
  }

  /**
   * Get cached data or execute function if cache miss/expired
   */
  async get<T>(
    functionName: string,
    fn: () => Promise<T>,
    args: any[] = [],
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const key = this.generateKey(functionName, args)
    const now = Date.now()
    
    // Check for pending request first (deduplication)
    const pending = this.pendingRequests.get(key)
    if (pending && (now - pending.timestamp) < 30000) { // 30s timeout for pending
      // PHASE 4D: Reduced console.log noise - only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Deduplicating request: ${functionName}`)
      }
      return pending.promise
    }
    
    // Check cache
    const cached = this.cache.get(key)
    if (cached && now < cached.expiresAt && !cached.isLoading) {
      // PHASE 4D: Reduced console.log noise - only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Cache hit: ${functionName}`, { 
          data: functionName === 'getTreasuryStatus' ? cached.data : 'data',
          age: Math.round((now - cached.timestamp) / 1000) + 's'
        })
      }
      return cached.data
    }
    
    // Cache miss or expired - execute function
    // PHASE 4D: Only log cache misses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Cache miss: ${functionName}`, { 
        reason: !cached ? 'not_found' : 'expired',
        ttl: Math.round(ttl / 1000) + 's'
      })
    }
    
    const promise = fn()
    
    // Store pending request for deduplication
    this.pendingRequests.set(key, { promise, timestamp: now })
    
    // Mark as loading
    if (cached) {
      cached.isLoading = true
    }
    
    try {
      const result = await promise
      
      // Store in cache
      this.cache.set(key, {
        data: result,
        timestamp: now,
        expiresAt: now + ttl,
        isLoading: false,
      })
      
      // PHASE 4D: Only log treasury data in development
      if (process.env.NODE_ENV === 'development' && functionName === 'getTreasuryStatus') {
        console.log(`💰 Cached treasury data:`, result)
      }
      
      // PHASE 4D: Reduced console.log noise
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Cached: ${functionName}`)
      }
      
      return result
    } catch (error) {
      // Remove failed request from pending
      this.pendingRequests.delete(key)
      
      // Mark as not loading
      if (cached) {
        cached.isLoading = false
      }
      
      throw error
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(key)
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string): void {
    const keysToDelete: string[] = []
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key)
      console.log(`🗑️ Invalidated cache for ${key}`)
    })
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
    console.log('🧹 Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.cache.keys())
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key)
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key))
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`)
    }
  }
}

// Global cache instance
export const requestCache = new RequestCache()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  requestCache.cleanup()
}, 5 * 60 * 1000)

/**
 * Wrapper for contract read operations with caching
 */
export async function cachedContractRead<T>(
  functionName: string,
  contractCall: () => Promise<T>,
  args: any[] = [],
  ttl: number = 30 * 1000 // 30 seconds default
): Promise<T> {
  return requestCache.get(functionName, contractCall, args, ttl)
}

/**
 * Invalidate cache when user performs write operations
 */
export function invalidateUserCache(userAddress?: string): void {
  if (userAddress) {
    requestCache.invalidate(userAddress.toLowerCase())
  }
  requestCache.invalidate('getReservoirStatus')
  requestCache.invalidate('getTreasuryStatus')
  requestCache.invalidate('COOLDOWN')
  // 🆕 Clear user balance caches for chain switches
  requestCache.invalidate('userNativeBalance') 
  requestCache.invalidate('userLinkBalance')
  console.log('💰 User balance caches invalidated for chain switch')
}

/**
 * Invalidate cache when tank balances change
 */
export function invalidateTankCache(): void {
  requestCache.invalidate('getReservoirStatus')
  requestCache.invalidate('getTreasuryStatus')
  requestCache.invalidate('balanceOf')
}

/**
 * Comprehensive cache invalidation for admin refresh operations
 * This ensures fresh data from blockchain when admin clicks refresh
 */
export function invalidateAllFaucetCache(): void {
  requestCache.invalidate('getReservoirStatus')
  requestCache.invalidate('getTreasuryStatus')
  requestCache.invalidate('COOLDOWN')
  requestCache.invalidate('thresholdFactor')
  requestCache.invalidate('balanceOf')
  requestCache.invalidate('userNativeBalance')  // Generic: was 'userMonBalance'
  requestCache.invalidate('userLinkBalance')
  console.log('🗑️ All faucet cache invalidated - next calls will hit blockchain')
} 