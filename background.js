// --- Caching Configuration ---
const CACHE_PREFIX = 'phishing_cache_';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
const SCREENSHOT_DELAY_MS = 1500; // Delay in milliseconds (e.g., 1.5 seconds)

/**
 * Retrieves the API key from chrome.storage.local.
 * @returns {Promise<string|null>} The API key or null if not set.
 */
async function getApiKey() {
  try {
    const result = await chrome.storage.local.get('geminiApiKey');
    return result.geminiApiKey || null;
  } catch (error) {
    console.error('Error retrieving API key:', error);
    return null;
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
  } catch (error) { // CORRECTED: Added curly braces
    console.error(`Error setting cache for ${hostname}:`, error);
  } // CORRECTED: This brace now correctly closes the catch
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
 * Checks a given URL and its screenshot with the Gemini API (ONLY IF NOT CACHED AS SAFE).
 * Caches the result based on hostname.
 * @param {string} url The URL to check.
 * @param {string} hostname The hostname derived from the URL.
 * @param {number} tabId The ID of the tab to capture.
 * @returns {Promise<boolean>} True if Gemini suspects phishing, false otherwise.
 */
async function checkUrlAndScreenshotAndCache(url, hostname, tabId) {
  console.log(`Attempting multimodal check for: ${url} (Hostname: ${hostname}, TabID: ${tabId})`);

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('No API key set. Please configure it in the extension options.');
    await chrome.runtime.openOptionsPage();
    return false;
  }

  const apiUrlWithKey = `${GEMINI_API_URL}?key=${apiKey}`;

  let screenshotDataUrl;
  try {
    // Wait for a brief period to allow page rendering
    await new Promise(resolve => setTimeout(resolve, SCREENSHOT_DELAY_MS));
    console.log(`Delay of ${SCREENSHOT_DELAY_MS}ms finished. Capturing screenshot for ${url}`);
    screenshotDataUrl = await captureVisibleTabPromise(null, { format: 'png' });
    console.log(`Screenshot captured successfully for ${url}`);
  } catch (error) {
    console.error(`Failed to capture screenshot for ${url} after delay:`, error);
    await setCachedStatus(hostname, 'safe', `Analysis skipped: Screenshot failed - ${error.message}`);
    return false;
  }

  const base64ImageData = screenshotDataUrl.split(',')[1];
  if (!base64ImageData) {
    console.error(`Failed to extract base64 data from screenshot for ${url}`);
    await setCachedStatus(hostname, 'safe', 'Analysis skipped: Failed to process screenshot data.');
    return false;
  }

  const prompt = `You are a phishing detection expert. Analyze the provided URL and webpage screenshot.
URL: ${url}
Critically evaluate if this site is a phishing scam.
Key Considerations:
1.  Visuals: Analyze branding (logos, colors, layout), form elements, and any suspicious visual cues in the screenshot.
2.  URL Structure: Examine the domain, subdomains, paths, and query parameters. Long, complex tokens (like JWTs or session IDs in query parameters such as 'key=', 'token=', 'session_id=') are common on legitimate authentication pages (e.g., login.company.com, auth.service.com) and are not inherently phishing indicators if the domain is trustworthy and visuals are consistent.
3.  Discrepancies: Look for mismatches between the URL's implied service and the visual content.

Is this site highly likely to be a phishing scam?
Respond strictly in the format: "YES/NO. Reason: [Explain your decision. If YES, specify the most critical visual phishing indicators from the screenshot and any truly suspicious URL patterns (not just standard tokens on known services). If NO, mention key legitimate visual cues, URL characteristics that support legitimacy (e.g., correct domain, SSL, recognized token patterns on auth pages), and overall consistency.]".`;

  console.log(`Checking URL and Screenshot with Gemini: ${url}`);

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
      return false;
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

    const cacheStatus = isPhishing ? 'phishing' : 'safe';
    await setCachedStatus(hostname, cacheStatus, reason);
    return isPhishing;

  } catch (error) {
    console.error(`Network or other error calling Gemini API (multimodal) for ${url}:`, error);
    return false;
  }
}

/**
 * THIS FUNCTION IS INJECTED INTO THE WEBPAGE (Version 2.7 - UI & Reason Refinements)
 * Creates and displays the sleek, modern alert overlay with improved readability and new logo.
 * @param {string} alertUrl The URL identified as potentially phishing.
 * @param {string} reason The reason why the site was flagged.
 */
function showPhishingAlertOnPage(alertUrl, reason = "Suspicious indicators detected.") {
  const existingOverlayId = 'aquarium-sleek-alert-overlay-v27';
  const existingStyleId = 'aquarium-sleek-styles-v27';
  if (document.getElementById(existingOverlayId)) {
    return;
  }
  console.log('Injecting Aquarium Sleek phishing alert overlay (v2.7)...');

  const cssStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
    #${existingOverlayId} {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.65), rgba(30, 58, 138, 0.75));
      background-image: linear-gradient(135deg, rgba(6, 182, 212, 0.65), rgba(30, 58, 138, 0.75)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath fill-rule='evenodd' d='M0 0h40v40H0V0zm40 40h40v40H40V40z'/%3E%3C/g%3E%3C/svg%3E");
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Lato', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 20px;
      opacity: 1;
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      animation: aquarium-overlay-fadein 0.5s ease-out;
    }
    .aquarium-alert-box {
      position: relative;
      width: 90%;
      max-width: 550px;
      border-radius: 16px;
      padding: 3px;
      transition: transform 0.3s ease-out;
      background: linear-gradient(115deg, #22d3ee, #a855f7);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
    }
    .aquarium-alert-box:hover {
      transform: scale(1.02);
    }
    .aquarium-alert-content {
      background-color: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px) saturate(120%);
      -webkit-backdrop-filter: blur(10px) saturate(120%);
      border-radius: 14px;
      padding: 32px 32px 32px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .aquarium-logo {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px auto;
      display: block;
    }
    .aquarium-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1E3A8A;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.3;
      text-align: center;
    }
    .aquarium-message, .aquarium-reason {
      font-size: 0.95rem;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 8px;
      text-align: center;
    }
    .aquarium-reason {
      color: #475569;
      margin-bottom: 24px;
      white-space: pre-line;
    }
    .aquarium-url {
      font-weight: 700;
      background: linear-gradient(90deg, #06b6d4, #a855f7);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: #06b6d4;
      display: block;
      margin: 8px auto 8px auto;
      word-break: break-all;
      text-align: center;
    }
    .aquarium-button-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 28px;
    }
    .aquarium-button {
      flex-grow: 0;
      flex-basis: calc(50% - 6px);
      min-width: 150px;
      padding: 12px 16px;
      font-size: 0.9rem;
      font-weight: 700;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-align: center;
      transition: all 0.3s ease;
      background-size: 200% auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .aquarium-button-understand {
      background-image: linear-gradient(to right, #FF7E5F 0%, #D81B60 51%, #FF7E5F 100%);
    }
    .aquarium-button-leave {
      background-image: linear-gradient(to right, #4FC3F7 0%, #5E35B1 51%, #4FC3F7 100%);
    }
    .aquarium-button:hover {
      background-position: right center;
      transform: translateY(-2px);
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
    }
    @keyframes aquarium-overlay-fadein {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;

  const overlay = document.createElement('div');
  overlay.id = existingOverlayId;

  const alertBox = document.createElement('div');
  alertBox.className = 'aquarium-alert-box';

  const alertContent = document.createElement('div');
  alertContent.className = 'aquarium-alert-content';

  const logo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  logo.setAttribute('viewBox', '0 0 50 40');
  logo.setAttribute('class', 'aquarium-logo');
  logo.innerHTML = `
    <defs>
      <linearGradient id="boxyFishGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#22d3ee;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect x="5" y="10" width="30" height="20" rx="3" ry="3" fill="url(#boxyFishGradient)" />
    <polygon points="35,12 45,5 45,35 35,28" fill="url(#boxyFishGradient)" />
    <circle cx="15" cy="20" r="3" fill="white" />
    <circle cx="15" cy="20" r="1.5" fill="#334155" />
  `;

  const title = document.createElement('h2');
  title.className = 'aquarium-title';
  title.textContent = 'Aquarium Alert: Heads Up!';

  const message = document.createElement('p');
  message.className = 'aquarium-message';
  const urlSpan = document.createElement('span');
  urlSpan.className = 'aquarium-url';
  urlSpan.textContent = alertUrl;
  message.textContent = `Our AI analysis suggests the site at `;
  message.appendChild(urlSpan);
  message.appendChild(document.createTextNode(` shows signs commonly associated with phishing.`));

  const reasonPara = document.createElement('p');
  reasonPara.className = 'aquarium-reason';
  reasonPara.textContent = `Reason: ${reason}`;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'aquarium-button-container';

  const leaveButton = document.createElement('button');
  leaveButton.className = 'aquarium-button aquarium-button-leave';
  leaveButton.textContent = 'Leave This Site';
  leaveButton.onclick = () => {
    window.top.location.href = 'https://www.google.com';
    const overlayToRemove = document.getElementById(existingOverlayId);
    if (overlayToRemove) overlayToRemove.remove();
    const styleElement = document.getElementById(existingStyleId);
    if (styleElement) styleElement.remove();
  };

  const understandButton = document.createElement('button');
  understandButton.className = 'aquarium-button aquarium-button-understand';
  understandButton.textContent = 'I Understand, Continue';
  understandButton.onclick = () => { // This arrow function might be missing a parameter name if one was intended
    const overlayToRemove = document.getElementById(existingOverlayId);
    if (overlayToRemove) overlayToRemove.remove();
    const styleElement = document.getElementById(existingStyleId);
    if (styleElement) styleElement.remove();
  };

  alertContent.appendChild(logo);
  alertContent.appendChild(title);
  alertContent.appendChild(message);
  alertContent.appendChild(reasonPara);
  buttonContainer.appendChild(leaveButton);
  buttonContainer.appendChild(understandButton);
  alertContent.appendChild(buttonContainer);

  alertBox.appendChild(alertContent);
  overlay.appendChild(alertBox);

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

    if (hostname.includes('generativelanguage.googleapis.com') ||
        hostname.endsWith('.google.com') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('github.com')
    ) {
      console.log(`Skipping analysis for whitelisted/internal URL: ${tab.url}`);
      return;
    }

    const { status: cachedStatus, reason: cachedReason } = await getCachedStatus(hostname);

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
      isPhishing = await checkUrlAndScreenshotAndCache(tab.url, hostname, tabId);
      if (isPhishing) {
        const { reason: updatedReason } = await getCachedStatus(hostname);
        reasonForAlert = updatedReason || "Suspicious indicators detected from AI analysis.";
      } else {
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
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.log('No API key found. Opening options page for setup.');
    chrome.runtime.openOptionsPage();
  }
});

console.log("Gemini Phishing Checker (URL + Screenshot) background script loaded (v0.3.4 - FP Handling, Syntax Fix 2).");