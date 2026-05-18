const getAuthHeader = () => {
  const savedUser = sessionStorage.getItem('Echo_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    return { 'Authorization': `Bearer ${user.token}` };
  }
  return {};
};

// ─── Response Cache ───
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const responseCache = new Map<string, CacheEntry>();

const DEFAULT_CACHE_TTL = 5000; // 5 seconds default cache
const CONFIG_CACHE_TTL = 60000; // 60 seconds for config data (rarely changes)

// URLs whose responses should be cached longer (shared config, panel settings, etc.)
const LONG_CACHE_PATTERNS = [
  '/shared-config',
  '/panel-settings',
  '/panel-roles',
  '/panel-admins',
];

function getCacheTTL(url: string): number {
  for (const pattern of LONG_CACHE_PATTERNS) {
    if (url.includes(pattern)) return CONFIG_CACHE_TTL;
  }
  return DEFAULT_CACHE_TTL;
}

function getCachedResponse(url: string): any | null {
  const entry = responseCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    responseCache.delete(url);
    return null;
  }
  return entry.data;
}

function setCachedResponse(url: string, data: any): void {
  // Only cache GET requests (identified by url without method override)
  const ttl = getCacheTTL(url);
  responseCache.set(url, { data, timestamp: Date.now(), ttl });
}

// ─── Cached Response Wrapper ───
// Wraps cached data in a Response-like object so callers can use .json() consistently
class CachedResponse {
  private data: any;
  ok: boolean = true;
  status: number = 200;
  statusText: string = 'OK';
  headers: Headers = new Headers();
  url: string = '';
  type: ResponseType = 'basic' as ResponseType;
  redirected: boolean = false;

  constructor(data: any) {
    this.data = data;
  }

  json(): Promise<any> {
    return Promise.resolve(this.data);
  }

  text(): Promise<string> {
    return Promise.resolve(typeof this.data === 'string' ? this.data : JSON.stringify(this.data));
  }

  clone(): CachedResponse {
    return new CachedResponse(this.data);
  }
}

// ─── Request Deduplication ───
const pendingRequests = new Map<string, Promise<any>>();

function getDedupKey(url: string, options?: RequestInit): string {
  return `${options?.method || 'GET'}:${url}`;
}

// ─── Invalidate cache for a specific pattern ───
export function invalidateCache(pattern?: string) {
  if (!pattern) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
    }
  }
}

// ─── Invalidate all cache entries for a server ───
export function invalidateServerCache(serverId: string) {
  invalidateCache(`/server/${serverId}`);
}

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const method = (options.method || 'GET').toUpperCase();
  const isGET = method === 'GET';

  // For non-GET requests, invalidate related cache entries
  if (!isGET) {
    // Clear cache entries that match the URL prefix (e.g., POST to /player/... clears /player/... cache)
    for (const key of responseCache.keys()) {
      // Match base path: /api/server/123/stashes/... → clear all /api/server/123/stashes cache
      const urlPath = url.split('?')[0];
      const keyPath = key.split('?')[0];
      // If the URL path is a prefix or related, clear the cache
      if (keyPath.startsWith(urlPath) || urlPath.startsWith(keyPath.split('/').slice(0, -1).join('/'))) {
        responseCache.delete(key);
      }
    }
  }

  // For GET requests, check cache first
  if (isGET) {
    const cached = getCachedResponse(url);
    if (cached) return new CachedResponse(cached);

    // Deduplication: if same request is already in-flight, reuse it
    // Clone the response so each caller gets their own readable Response body
    const dedupKey = getDedupKey(url, options);
    if (pendingRequests.has(dedupKey)) {
      return (pendingRequests.get(dedupKey)!).then((response: any) => response.clone());
    }
  }

  const fetchPromise = fetch(url, { ...options, headers })
    .then(response => {
      if (isGET && response.ok) {
        // Clone and cache the response
        const cloned = response.clone();
        cloned.json().then(data => {
          setCachedResponse(url, data);
        }).catch(() => {});
      }
      return response;
    })
    .finally(() => {
      if (isGET) {
        const dedupKey = getDedupKey(url, options);
        pendingRequests.delete(dedupKey);
      }
    });

  if (isGET) {
    const dedupKey = getDedupKey(url, options);
    pendingRequests.set(dedupKey, fetchPromise);
  }

  return fetchPromise;
};

// ─── Quick fetch for action results ───
// Fetches with cache bypass for immediate refresh after an action
export const fetchWithAuthNoCache = async (url: string, options: RequestInit = {}) => {
  // Invalidate cache for this URL
  for (const key of responseCache.keys()) {
    if (key.includes(url.split('?')[0])) {
      responseCache.delete(key);
    }
  }
  return fetchWithAuth(url, options);
};
