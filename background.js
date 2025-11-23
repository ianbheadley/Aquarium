// --- Caching Configuration ---
const CACHE_PREFIX = 'phishing_cache_';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
const SCREENSHOT_DELAY_MS = 1500; // Delay in milliseconds (e.g., 1.5 seconds)
const EMAIL_SCREENSHOT_DELAY_MS = 2500; // Longer delay for Gmail to render

/**
 * Retrieves the AI Provider Configuration from chrome.storage.local.
 * @returns {Promise<object>} The configuration object.
 */
async function getAiProviderConfig() {
  try {
    const result = await chrome.storage.local.get([
        'aiProvider',
        'geminiApiKey',
        'ollamaUrl',
        'ollamaModel',
        'reportingWebhookUrl',
        'enableGmail',
        'forceLocalGmail'
    ]);
    return {
      provider: result.aiProvider || 'gemini',
      geminiApiKey: result.geminiApiKey || null,
      ollamaUrl: result.ollamaUrl || 'http://localhost:11434/api/generate',
      ollamaModel: result.ollamaModel || 'llava',
      reportingWebhookUrl: result.reportingWebhookUrl || null,
      enableGmail: result.enableGmail || false,
      forceLocalGmail: result.forceLocalGmail !== undefined ? result.forceLocalGmail : true
    };
  } catch (error) {
    console.error('Error retrieving configuration:', error);
    return { provider: 'gemini', geminiApiKey: null, enableGmail: false };
  }
}

/**
 * Sets the cached status and reason for a given hostname.
 * @param {string} hostname The hostname (domain) to cache.
 * @param {'safe'|'phishing'} status The status to cache.
 * @param {string} reason The reason provided by the analysis.
 */
async function setCachedStatus(hostname, status, reason = "") {
  const key = CACHE_PREFIX + hostname;
  const cacheEntry = {
    status: status,
    reason: reason,
    timestamp: Date.now()
  };
  try {
    await chrome.storage.local.set({ [key]: cacheEntry });
    console.log(`Cached ${hostname} as ${status}. Reason: ${reason}`);
  } catch (error) {
    console.error(`Error setting cache for ${hostname}:`, error);
  }
}

/**
 * Gets the cached status and reason for a given hostname.
 * @param {string} hostname The hostname (domain) to check.
 * @returns {Promise<{status: string|null, reason: string|null}>} Object with status and reason.
 */
async function getCachedStatus(hostname) {
  const key = CACHE_PREFIX + hostname;
  try {
    const result = await chrome.storage.local.get(key);
    if (result && result[key] && result[key].status) {
      console.log(`Cache hit for ${hostname}: ${result[key].status}`);
      return { status: result[key].status, reason: result[key].reason || null };
    }
  } catch (error) {
    console.error(`Error getting cache for ${hostname}:`, error);
  }
  console.log(`Cache miss for ${hostname}`);
  return { status: null, reason: null };
}

/**
 * Helper function to capture the visible tab as a promise.
 * @param {number} tabId The ID of the tab to capture.
 * @param {object} options Options for capture (e.g., format).
 * @returns {Promise<string>} A promise resolving with the data URL.
 */
function captureVisibleTabPromise(tabId, options) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(tabId, options, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (!dataUrl) {
        reject(new Error("captureVisibleTab returned empty dataUrl, potentially due to page loading or permissions issues."));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

/**
 * Report detection to a centralized webhook.
 * @param {string} url The URL detected.
 * @param {string} reason The detection reason.
 * @param {string} detector The name of the detector (e.g. Gemini, Ollama).
 * @param {string} webhookUrl The webhook endpoint.
 */
async function reportToWebhook(url, reason, detector, webhookUrl) {
    if (!webhookUrl) return;

    const payload = {
        event: 'phishing_detection',
        url: url,
        reason: reason,
        detector: detector,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };

    try {
        console.log(`Reporting to webhook: ${webhookUrl}`);
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Failed to report to webhook:', error);
    }
}

/**
 * Checks a given URL and its screenshot with the Ollama API.
 * @param {string} url The URL to check.
 * @param {string} base64ImageData Base64 encoded screenshot.
 * @param {object} config The Ollama configuration.
 * @param {boolean} isEmail Whether this is an email analysis context.
 * @returns {Promise<{isPhishing: boolean, reason: string}>}
 */
async function checkUrlWithOllama(url, base64ImageData, config, isEmail = false) {
    let prompt;

    if (isEmail) {
        prompt = `You are a security expert analyzing a screenshot of an email message.
The user is viewing this email in a web client. Ignore the email client interface (menus, sidebars).
Focus strictly on the EMAIL CONTENT (sender, subject, body, links/buttons).

Does this email appear to be a PHISHING attempt?
Look for:
1. Urgency or threats (e.g., "Account suspended").
2. Suspicious requests for credentials or payments.
3. Mismatched logos or poor formatting.

Is this email content highly likely to be a phishing scam?
Respond strictly in the format: "YES/NO. Reason: [Explain your decision.]".`;
    } else {
        prompt = `You are a phishing detection expert. Analyze the provided URL and webpage screenshot.
URL: ${url}
Critically evaluate if this site is a phishing scam.
Key Considerations:
1.  Visuals: Analyze branding (logos, colors, layout), form elements, and any suspicious visual cues in the screenshot.
2.  URL Structure: Examine the domain, subdomains, paths, and query parameters.
3.  Discrepancies: Look for mismatches between the URL's implied service and the visual content.

Is this site highly likely to be a phishing scam?
Respond strictly in the format: "YES/NO. Reason: [Explain your decision.]".`;
    }

    try {
        const response = await fetch(config.ollamaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.ollamaModel,
                prompt: prompt,
                images: [base64ImageData],
                stream: false
            })
        });

        if (!response.ok) {
            console.error(`Ollama API Error ${response.status}`);
            return { isPhishing: false, reason: `Ollama API Error: ${response.status}` };
        }

        const data = await response.json();
        const resultText = data.response.trim();
        console.log(`Ollama Raw Result: ${resultText}`);

        let isPhishing = false;
        let reason = "Analysis inconclusive.";

        const match = resultText.match(/^(YES|NO)\.?\s*Reason:\s*(.*)/is);
        if (match) {
            isPhishing = (match[1].toUpperCase() === 'YES');
            reason = match[2].trim();
        } else {
            // Fallback parsing
             if (resultText.toUpperCase().startsWith('YES')) {
                isPhishing = true;
                reason = resultText.substring(3).trim();
            } else if (resultText.toUpperCase().startsWith('NO')) {
                isPhishing = false;
                 reason = resultText.substring(2).trim();
            }
        }

        return { isPhishing, reason };

    } catch (error) {
        console.error("Error calling Ollama:", error);
        return { isPhishing: false, reason: "Error communicating with Ollama." };
    }
}


/**
 * Checks a given URL and its screenshot with the Gemini API.
 * @param {string} url The URL to check.
 * @param {string} base64ImageData Base64 encoded screenshot.
 * @param {string} apiKey The Gemini API Key.
 * @param {boolean} isEmail Whether this is an email analysis context.
 * @returns {Promise<{isPhishing: boolean, reason: string}>}
 */
async function checkUrlWithGemini(url, base64ImageData, apiKey, isEmail = false) {
    let prompt;

    if (isEmail) {
        prompt = `You are a security expert analyzing a screenshot of an email message.
The user is viewing this email in a web client. Ignore the email client interface (menus, sidebars).
Focus strictly on the EMAIL CONTENT (sender, subject, body, links/buttons).

Does this email appear to be a PHISHING attempt?
Look for:
1. Urgency or threats (e.g., "Account suspended").
2. Suspicious requests for credentials or payments.
3. Mismatched logos or poor formatting.

Is this email content highly likely to be a phishing scam?
Respond strictly in the format: "YES/NO. Reason: [Explain your decision based on the email content visible in the image.]".`;
    } else {
        prompt = `You are a phishing detection expert. Analyze the provided URL and webpage screenshot.
URL: ${url}
Critically evaluate if this site is a phishing scam.
Key Considerations:
1.  Visuals: Analyze branding (logos, colors, layout), form elements, and any suspicious visual cues in the screenshot.
2.  URL Structure: Examine the domain, subdomains, paths, and query parameters. Long, complex tokens (like JWTs or session IDs in query parameters such as 'key=', 'token=', 'session_id=') are common on legitimate authentication pages (e.g., login.company.com, auth.service.com) and are not inherently phishing indicators if the domain is trustworthy and visuals are consistent.
3.  Discrepancies: Look for mismatches between the URL's implied service and the visual content.

Is this site highly likely to be a phishing scam?
Respond strictly in the format: "YES/NO. Reason: [Explain your decision. If YES, specify the most critical visual phishing indicators from the screenshot and any truly suspicious URL patterns (not just standard tokens on known services). If NO, mention key legitimate visual cues, URL characteristics that support legitimacy (e.g., correct domain, SSL, recognized token patterns on auth pages), and overall consistency.]".`;
    }

  const apiUrlWithKey = `${GEMINI_API_URL}?key=${apiKey}`;

  try {
    const response = await fetch(apiUrlWithKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/png',
                data: base64ImageData
              }
            }
          ]
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 100, topK: 3 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ]
      }),
    });

    if (!response.ok) {
      let errorBody = await response.text();
      try { errorBody = JSON.parse(errorBody); } catch(e) { /* Ignore */ }
      console.error(`Gemini API Error ${response.status}:`, errorBody);
      return { isPhishing: false, reason: `Gemini API Error: ${response.status}` };
    }

    const data = await response.json();
    let isPhishing = false;
    let reason = "Analysis inconclusive. Could not fully parse Gemini's response.";

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
      const resultText = data.candidates[0].content.parts[0].text.trim();
      console.log(`Gemini Raw Multimodal Result for ${url}: ${resultText}`);
      const match = resultText.match(/^(YES|NO)\.?\s*Reason:\s*(.*)/is);
      if (match) {
        isPhishing = (match[1].toUpperCase() === 'YES');
        reason = match[2].trim();
        console.log(`Gemini Parsed Multimodal Result: ${isPhishing ? 'YES' : 'NO'}. Reason: ${reason}`);
      } else {
        if (resultText.toUpperCase().startsWith('YES')) {
            isPhishing = true;
            reason = resultText.substring(resultText.indexOf(':') > -1 ? resultText.indexOf(':') + 1 : 3).trim() || "Suspicious indicators detected based on URL/Screenshot analysis.";
        } else if (resultText.toUpperCase().startsWith('NO')) {
            isPhishing = false;
            reason = resultText.substring(resultText.indexOf(':') > -1 ? resultText.indexOf(':') + 1 : 2).trim() || "No clear phishing indicators found in URL/Screenshot analysis.";
        } else {
            isPhishing = false;
            reason = `Could not determine YES/NO from response: ${resultText}`;
        }
        console.log(`Gemini Fallback Parsed Multimodal Result: ${isPhishing ? 'YES' : 'NO'}. Reason: ${reason}`);
      }
    } else if (data.promptFeedback && data.promptFeedback.blockReason) {
      reason = `Analysis blocked by safety filters: ${data.promptFeedback.blockReason}. Assuming safe.`;
      console.warn(`Gemini multimodal request blocked for ${url}. Reason: ${reason}`);
      isPhishing = false;
    } else {
      reason = "Could not parse Gemini response structure or response was empty. Assuming safe.";
      console.warn(reason, data);
      isPhishing = false;
    }

    return { isPhishing, reason };

  } catch (error) {
    console.error(`Network or other error calling Gemini API (multimodal) for ${url}:`, error);
    return { isPhishing: false, reason: "Network or other error." };
  }
}


/**
 * Checks a given URL and its screenshot with the configured AI Provider (ONLY IF NOT CACHED AS SAFE).
 * Caches the result based on hostname.
 * @param {string} url The URL to check.
 * @param {string} hostname The hostname derived from the URL.
 * @param {number} tabId The ID of the tab to capture.
 * @returns {Promise<{isPhishing: boolean, reason: string}>}
 */
async function checkUrlAndScreenshotAndCache(url, hostname, tabId) {
  const config = await getAiProviderConfig();

  const isGmail = hostname === 'mail.google.com';

  console.log(`Attempting multimodal check for: ${url} (Hostname: ${hostname}, TabID: ${tabId}, IsGmail: ${isGmail})`);

  // Determine Provider
  let useOllama = (config.provider === 'ollama');
  if (isGmail && config.forceLocalGmail) {
      console.log("Gmail detected: Forcing use of Local Ollama provider for privacy.");
      useOllama = true;
  }

  // Check keys/config validity
  if (!useOllama && !config.geminiApiKey) {
      console.error('No Gemini API key set. Please configure it in the extension options.');
      await chrome.runtime.openOptionsPage();
      return { isPhishing: false, reason: "No API Key" };
  }

  let screenshotDataUrl;
  try {
    // Wait for a brief period to allow page rendering
    const delay = isGmail ? EMAIL_SCREENSHOT_DELAY_MS : SCREENSHOT_DELAY_MS;
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log(`Delay of ${delay}ms finished. Capturing screenshot for ${url}`);
    screenshotDataUrl = await captureVisibleTabPromise(null, { format: 'png' });
    console.log(`Screenshot captured successfully for ${url}`);
  } catch (error) {
    console.error(`Failed to capture screenshot for ${url} after delay:`, error);
    await setCachedStatus(hostname, 'safe', `Analysis skipped: Screenshot failed - ${error.message}`);
    return { isPhishing: false, reason: "Screenshot failed" };
  }

  const base64ImageData = screenshotDataUrl.split(',')[1];
  if (!base64ImageData) {
    console.error(`Failed to extract base64 data from screenshot for ${url}`);
    await setCachedStatus(hostname, 'safe', 'Analysis skipped: Failed to process screenshot data.');
    return { isPhishing: false, reason: "No image data" };
  }

  const providerName = useOllama ? 'ollama' : 'gemini';
  console.log(`Checking URL and Screenshot with Provider: ${providerName}`);

  let result;
  if (useOllama) {
      result = await checkUrlWithOllama(url, base64ImageData, config, isGmail);
  } else {
      result = await checkUrlWithGemini(url, base64ImageData, config.geminiApiKey, isGmail);
  }

  if (result.isPhishing && config.reportingWebhookUrl) {
      await reportToWebhook(url, result.reason, providerName, config.reportingWebhookUrl);
  }

  if (!isGmail) {
      const cacheStatus = result.isPhishing ? 'phishing' : 'safe';
      await setCachedStatus(hostname, cacheStatus, result.reason);
  }

  return result;
}

/**
 * THIS FUNCTION IS INJECTED INTO THE WEBPAGE (Updated for Enterprise/Professional Look)
 * Creates and displays the professional alert overlay.
 * @param {string} alertUrl The URL identified as potentially phishing.
 * @param {string} reason The reason why the site was flagged.
 */
function showPhishingAlertOnPage(alertUrl, reason = "Suspicious indicators detected.") {
  const existingOverlayId = 'aquarium-alert-overlay-v3';
  const existingStyleId = 'aquarium-alert-styles-v3';
  if (document.getElementById(existingOverlayId)) {
    return;
  }
  console.log('Injecting Aquarium Enterprise phishing alert overlay...');

  const cssStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    #${existingOverlayId} {
      position: fixed;
      inset: 0;
      background-color: rgba(15, 23, 42, 0.9);
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 20px;
      opacity: 1;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      animation: aquarium-fadein 0.3s ease-out;
    }
    .aquarium-modal {
      background-color: #ffffff;
      width: 100%;
      max-width: 600px;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .aquarium-header {
      background-color: #fee2e2;
      padding: 24px 32px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid #fecaca;
    }
    .aquarium-icon {
      width: 32px;
      height: 32px;
      color: #dc2626;
      flex-shrink: 0;
    }
    .aquarium-title {
      color: #991b1b;
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
    }
    .aquarium-content {
      padding: 32px;
      color: #334155;
    }
    .aquarium-message {
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .aquarium-url-box {
      background-color: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.9rem;
      color: #475569;
      word-break: break-all;
      margin-bottom: 24px;
    }
    .aquarium-reason-label {
        font-weight: 600;
        font-size: 0.875rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
    }
    .aquarium-reason {
      font-size: 0.95rem;
      color: #1e293b;
      background-color: #fff1f2;
      border-left: 4px solid #e11d48;
      padding: 16px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 32px;
      line-height: 1.5;
    }
    .aquarium-actions {
      display: flex;
      gap: 16px;
      justify-content: flex-end;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .aquarium-btn {
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .aquarium-btn-primary {
      background-color: #dc2626;
      color: white;
    }
    .aquarium-btn-primary:hover {
      background-color: #b91c1c;
    }
    .aquarium-btn-secondary {
      background-color: white;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }
    .aquarium-btn-secondary:hover {
      background-color: #f8fafc;
      color: #334155;
      border-color: #94a3b8;
    }
    @keyframes aquarium-fadein {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
  `;

  const overlay = document.createElement('div');
  overlay.id = existingOverlayId;

  const modal = document.createElement('div');
  modal.className = 'aquarium-modal';

  // Header
  const header = document.createElement('div');
  header.className = 'aquarium-header';

  const warningIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  warningIcon.setAttribute('class', 'aquarium-icon');
  warningIcon.setAttribute('fill', 'none');
  warningIcon.setAttribute('viewBox', '0 0 24 24');
  warningIcon.setAttribute('stroke', 'currentColor');
  warningIcon.setAttribute('stroke-width', '2');
  warningIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`;

  const title = document.createElement('h2');
  title.className = 'aquarium-title';
  title.textContent = 'Security Alert: Potential Phishing Detected';

  header.appendChild(warningIcon);
  header.appendChild(title);
  modal.appendChild(header);

  // Content
  const content = document.createElement('div');
  content.className = 'aquarium-content';

  const message = document.createElement('p');
  message.className = 'aquarium-message';
  message.textContent = 'Aquarium has analyzed this page and identified it as a potential security threat. Accessing this site may compromise your personal information.';

  const urlBox = document.createElement('div');
  urlBox.className = 'aquarium-url-box';
  urlBox.textContent = alertUrl;

  const reasonLabel = document.createElement('div');
  reasonLabel.className = 'aquarium-reason-label';
  reasonLabel.textContent = 'Analysis Report';

  const reasonBox = document.createElement('div');
  reasonBox.className = 'aquarium-reason';
  reasonBox.textContent = reason;

  const actions = document.createElement('div');
  actions.className = 'aquarium-actions';

  const proceedButton = document.createElement('button');
  proceedButton.className = 'aquarium-btn aquarium-btn-secondary';
  proceedButton.textContent = 'Ignore Risk & Proceed';
  proceedButton.onclick = () => {
      const overlayToRemove = document.getElementById(existingOverlayId);
      if (overlayToRemove) overlayToRemove.remove();
      const styleElement = document.getElementById(existingStyleId);
      if (styleElement) styleElement.remove();
  };

  const leaveButton = document.createElement('button');
  leaveButton.className = 'aquarium-btn aquarium-btn-primary';
  leaveButton.textContent = 'Get Me Out of Here';
  leaveButton.onclick = () => {
     window.top.location.href = 'https://google.com';
  };

  actions.appendChild(proceedButton);
  actions.appendChild(leaveButton);

  content.appendChild(message);
  content.appendChild(urlBox);
  content.appendChild(reasonLabel);
  content.appendChild(reasonBox);
  content.appendChild(actions);

  modal.appendChild(content);
  overlay.appendChild(modal);

  const style = document.createElement('style');
  style.id = existingStyleId;
  style.textContent = cssStyles;

  const appendTarget = document.documentElement || document.body;
  if (appendTarget) {
    appendTarget.appendChild(overlay);
    (document.head || appendTarget).appendChild(style);
  } else {
    console.error("Could not find documentElement or body to append phishing alert.");
  }
}


// --- Event Listener for Tab Updates ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch (error) {
      console.error(`Invalid URL encountered: ${tab.url}`, error);
      return;
    }

    // Check config to see if we scan Gmail
    const config = await getAiProviderConfig();
    const isGmail = hostname === 'mail.google.com';

    if (isGmail && !config.enableGmail) {
         console.log(`Skipping Gmail (Scanning Disabled): ${tab.url}`);
         return;
    }

    if (!isGmail && (
        hostname.includes('generativelanguage.googleapis.com') ||
        hostname.endsWith('.google.com') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('github.com')
    )) {
      console.log(`Skipping analysis for whitelisted/internal URL: ${tab.url}`);
      return;
    }

    let cachedStatus = null, cachedReason = null;

    // Don't use cache for Gmail context
    if (!isGmail) {
        const cache = await getCachedStatus(hostname);
        cachedStatus = cache.status;
        cachedReason = cache.reason;
    }

    let isPhishing = false;
    let reasonForAlert = "Suspicious indicators detected.";

    if (cachedStatus === 'phishing') {
      console.log(`Triggering alert for ${hostname} based on cache.`);
      isPhishing = true;
      reasonForAlert = cachedReason || reasonForAlert;
    } else if (cachedStatus === 'safe') {
      console.log(`Skipping API check for ${hostname} (cached as safe).`);
      return;
    } else {
      console.log(`No conclusive cache entry for ${hostname}. Proceeding with AI check.`);
      const analysisResult = await checkUrlAndScreenshotAndCache(tab.url, hostname, tabId);
      isPhishing = analysisResult.isPhishing;

      if (isPhishing) {
        reasonForAlert = analysisResult.reason || "Suspicious indicators detected from AI analysis.";
      } else if (!isGmail) {
        // Only check cache again for non-Gmail sites
        const { reason: safeReason } = await getCachedStatus(hostname);
        console.log(`Site ${hostname} determined safe or inconclusive by AI. Reason: ${safeReason || 'No specific reason provided.'}`);
      }
    }

    if (isPhishing) {
      console.warn(`PHISHING ALERT action for: ${tab.url}. Reason: ${reasonForAlert}`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: showPhishingAlertOnPage,
          args: [tab.url, reasonForAlert]
        });
      } catch (err) {
        console.error(`Failed to inject phishing alert script into tab ${tabId} (${tab.url}):`, err);
      }
    }
  }
});

// --- Check API Key on Startup ---
chrome.runtime.onInstalled.addListener(async () => {
  const config = await getAiProviderConfig();
  if (config.provider === 'gemini' && !config.geminiApiKey) {
    console.log('No API key found. Opening options page for setup.');
    chrome.runtime.openOptionsPage();
  }
});

console.log("Gemini/Ollama Phishing Checker (URL + Screenshot) background script loaded.");