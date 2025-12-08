// background.js - Service Worker
import { Rules } from './rules.js';
import { Routing } from './routing.js';
import { Capture } from './capture.js';
import { Cloud } from './cloud.js';
import { Cache } from './cache.js';

console.log('Aquarium Service Worker Loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Aquarium installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'credentialDetected') {
    console.log('Credential detected at:', message.url);
    // Use sender.tab.id for capture operations
    analyzePage(message.url, sender.tab.id);
  } else if (message.action === 'trustPage') {
    console.log('User trusted page:', message.url);
    Cache.addSafe(message.url);
  }
});

async function analyzePage(url, tabId) {
  // 1. Instant Rules
  const ruleResult = await Rules.run(url);
  if (ruleResult.result === 'safe') {
      console.log('Rules verdict: SAFE');
      return;
  }
  if (ruleResult.result === 'suspicious') {
      console.warn('Rules verdict: SUSPICIOUS', ruleResult.reason);
      // We could trigger shield immediately or continue to confirm with AI
      // Plan says "Flag if any hit". For now, we continue to AI for confirmation/details,
      // or we could mark as high priority.
  }

  // 2. Cache Check
  if (await Cache.isSafe(url)) {
      console.log('Cache verdict: SAFE');
      return;
  }

  // 3. Routing
  const route = await Routing.determineRoute(url);

  // 4. Data Capture
  console.log('Capturing page data...');
  const textContent = await Capture.getPageContent(tabId);
  const rawScreenshot = await Capture.captureScreenshot(tabId);
  const resizedScreenshot = await Capture.resizeScreenshot(rawScreenshot);

  // 5. Analysis
  let verdict;
  if (route === 'cloud') {
      verdict = await Cloud.analyze(url, textContent.text, resizedScreenshot);
  } else {
      verdict = await analyzeLocal(url, textContent.text, resizedScreenshot);
  }

  console.log('Final Verdict:', verdict);

  // 6. Act on Verdict
  if (verdict && verdict.is_phishing === false) {
      await Cache.addSafe(url);
  } else if (verdict && verdict.is_phishing === true) {
      console.warn('PHISHING DETECTED! Triggering shield...');
      chrome.tabs.sendMessage(tabId, {
          action: 'showShield',
          reason: verdict.reason,
          confidence: verdict.confidence
      });
  }
}

async function analyzeLocal(url, text, screenshot) {
  console.log('Running Local Analysis (Ollama)...');
  const settings = await chrome.storage.sync.get(['modelName']);
  const model = settings.modelName || 'qwen2.5-vl:7b';

  // Construct prompt. For multimodal, we need to adapt depending on Ollama API support for images in /api/generate
  // qwen2.5-vl supports images.

  const prompt = `Analyze this phishing suspect. URL: ${url}. Page Text: ${text}. Return JSON: {is_phishing: bool, reason: str, confidence: num}`;

  const requestBody = {
    model: model,
    prompt: prompt,
    stream: false,
    format: "json"
  };

  if (screenshot) {
      // Ollama expects base64 string in "images" array
      // Remove header "data:image/jpeg;base64,"
      const base64Data = screenshot.split(',')[1];
      requestBody.images = [base64Data];
  }

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.response);
  } catch (error) {
    console.error('Local analysis failed:', error);
    return { error: error.message };
  }
}
