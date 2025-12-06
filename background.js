// background.js - Service Worker
console.log('Aquarium Service Worker Loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Aquarium installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'credentialDetected') {
    console.log('Credential detected at:', message.url, message.rect);
    analyzePage(message.url);
  }
});

async function analyzePage(url) {
  // Prototype Ollama integration
  console.log('Analyzing page:', url);

  // Get settings
  const settings = await chrome.storage.sync.get(['modelName']);
  const model = settings.modelName || 'qwen2.5-vl:7b';

  const prompt = `Analyze this URL for phishing: ${url}. Return JSON: {is_phishing: bool, reason: str, confidence: num}`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        format: "json"
      })
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Ollama analysis result:', data.response);

    // Parse the JSON response from the model
    try {
        const result = JSON.parse(data.response);
        console.log('Parsed result:', result);
    } catch (e) {
        console.warn('Failed to parse model JSON:', e);
    }

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}
