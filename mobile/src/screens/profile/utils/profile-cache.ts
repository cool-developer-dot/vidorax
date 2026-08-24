/**
 * Re-export profile memory cache from the auth service layer.
 */

export {
  clearProfileCache,
  getProfileCacheTimestamp,
  isProfileCacheStale,
  markProfileCacheFresh,
} from '@/services/auth/profile-memory-cache';
