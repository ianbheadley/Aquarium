// cache.js - Verdict Caching

const CACHE_KEY = 'aquarium_safelist';

export const Cache = {
  async isSafe(url) {
    try {
        const hostname = new URL(url).hostname;
        const storage = await chrome.storage.local.get([CACHE_KEY]);
        const safelist = storage[CACHE_KEY] || {};

        const entry = safelist[hostname];
        if (entry) {
            // Check expiry (30 days)
            const now = Date.now();
            if (now - entry.timestamp < 30 * 24 * 60 * 60 * 1000) {
                return true;
            } else {
                // Expired
                delete safelist[hostname];
                await chrome.storage.local.set({ [CACHE_KEY]: safelist });
            }
        }
        return false;
    } catch (e) {
        return false;
    }
  },

  async addSafe(url) {
    try {
        const hostname = new URL(url).hostname;
        const storage = await chrome.storage.local.get([CACHE_KEY]);
        const safelist = storage[CACHE_KEY] || {};

        safelist[hostname] = {
            timestamp: Date.now()
        };

        await chrome.storage.local.set({ [CACHE_KEY]: safelist });
    } catch (e) {
        console.error('Failed to cache safe domain:', e);
    }
  }
};
