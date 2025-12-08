// routing.js
import { ULTRA_SENSITIVE_DOMAINS } from './constants.js';

export const Routing = {
  async determineRoute(url) {
    const hostname = new URL(url).hostname;

    // Check ultra-sensitive list
    const isSensitive = ULTRA_SENSITIVE_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
    );

    if (isSensitive) {
        console.log(`Routing: ${url} is Ultra-Sensitive. Forcing LOCAL only.`);
        return 'local';
    }

    // Check user preference
    const settings = await chrome.storage.sync.get(['privacyMode']);
    const mode = settings.privacyMode || 'max_privacy';

    console.log(`Routing: Privacy mode is ${mode}`);

    switch (mode) {
        case 'max_privacy':
            return 'local';
        case 'balanced':
            // "Local + Opt-in Cloud" - for now we default to local, but if we had confidence scoring
            // we might use cloud if local is unsure. The plan says "local unless opt-in cloud".
            // Implementation: Check if cloud is configured (API key).
            const cloudKey = await chrome.storage.sync.get(['apiKey']);
            if (cloudKey.apiKey) return 'cloud'; // Or hybrid? Plan says "Balanced: local unless opt-in cloud".
                                                 // I'll stick to 'local' primarily for now, or allow cloud if key exists.
                                                 // Actually, let's say "balanced" means we TRY local, if fails/unsure, use cloud.
                                                 // But for routing decision *before* analysis, let's adhere to "local unless opt-in".
                                                 // If I return 'cloud', it implies cloud is allowed.
            return 'local';
        case 'max_protection':
            return 'cloud'; // "Cloud Preferred"
        default:
            return 'local';
    }
  }
};
