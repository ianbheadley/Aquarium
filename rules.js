// rules.js - Instant Checks

// Prototype list of known good domains (would be a large Bloom filter or Set in prod)
const KNOWN_GOOD_DOMAINS = new Set([
  'google.com', 'facebook.com', 'amazon.com', 'apple.com', 'microsoft.com',
  'github.com', 'stackoverflow.com', 'wikipedia.org', 'twitter.com', 'linkedin.com',
  'localhost'
]);

// Prototype list of target brands for typosquatting
const TARGET_BRANDS = [
  'google', 'facebook', 'amazon', 'apple', 'microsoft', 'paypal', 'chase', 'bankofamerica'
];

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export const Rules = {
  /**
   * Check if URL is in known good list
   */
  isKnownGood(url) {
    try {
      const hostname = new URL(url).hostname;
      // Handle subdomains roughly
      const parts = hostname.split('.');
      if (parts.length > 2) {
          const domain = parts.slice(-2).join('.');
          if (KNOWN_GOOD_DOMAINS.has(domain)) return true;
      }
      return KNOWN_GOOD_DOMAINS.has(hostname);
    } catch (e) {
      return false;
    }
  },

  /**
   * Check for typosquatting
   */
  isTyposquat(url) {
    try {
      const hostname = new URL(url).hostname;
      const domain = hostname.split('.')[0]; // Very basic extraction

      for (const brand of TARGET_BRANDS) {
        const dist = levenshtein(domain, brand);
        // If distance is small but not 0 (exact match would be caught by isKnownGood if valid, or legitimate use)
        // We only care if it's close but NOT the brand itself (assuming the brand owns the exact match)
        // But wait, if it's "google.com" dist is 0. If it's "g00gle.com" dist is 2.
        if (dist > 0 && dist <= 2) {
            console.log(`Typosquat suspect: ${domain} vs ${brand} (dist: ${dist})`);
            return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  /**
   * Simple SSL check (stub)
   */
  async checkCert(url) {
    if (url.startsWith('http://')) return { secure: false, reason: 'HTTP only' };
    try {
        // In a real extension we might use more advanced cert inspection if possible,
        // or rely on browser's "secure" state.
        // Using fetch HEAD to check reachability and if it throws cert error.
        await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        return { secure: true };
    } catch (e) {
        return { secure: false, reason: e.message };
    }
  },

  async run(url) {
    console.log('Running rules for:', url);
    if (this.isKnownGood(url)) {
      return { result: 'safe', reason: 'Known good domain' };
    }

    if (this.isTyposquat(url)) {
      return { result: 'suspicious', reason: 'Possible typosquatting' };
    }

    const certStatus = await this.checkCert(url);
    if (!certStatus.secure) {
        return { result: 'suspicious', reason: `Insecure connection: ${certStatus.reason}` };
    }

    return { result: 'unknown' };
  }
};
