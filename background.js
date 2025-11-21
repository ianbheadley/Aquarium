
// --- Configuration ---
const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llava';

// --- Helpers ---
async function getOllamaConfig() {
    const data = await chrome.storage.local.get(['ollamaEndpoint', 'ollamaModel']);
    return {
        endpoint: data.ollamaEndpoint || DEFAULT_ENDPOINT,
        model: data.ollamaModel || DEFAULT_MODEL
    };
}

function captureVisibleTabPromise() {
    return new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (!dataUrl) {
                reject(new Error("Empty screenshot"));
            } else {
                resolve(dataUrl);
            }
        });
    });
}

// --- Analysis ---
async function analyzeWithOllama(text, screenshotDataUrl) {
    const config = await getOllamaConfig();
    const base64Image = screenshotDataUrl.split(',')[1];

    const prompt = `You are a cybersecurity expert specializing in phishing detection.
    Analyze the following email content and the provided screenshot of the email view.

    Email Content (Excerpt):
    ${text}

    Task: Determine if this email is a phishing attempt.

    Respond STRICTLY in the following JSON format:
    {
        "isPhishing": boolean,
        "reason": "string explaining why"
    }

    If you are unsure, lean towards "false" unless there are clear indicators (urgency, suspicious links, mismatching branding).
    Keep the reason concise (under 30 words) and professional.`;

    try {
        const response = await fetch(`${config.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                format: "json"
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Ollama Raw Response:", data.response);

        try {
            const result = JSON.parse(data.response);
            return result;
        } catch (parseError) {
            // Fallback if model didn't return strict JSON
            console.warn("Failed to parse JSON from Ollama, attempting heuristic parsing:", data.response);
            const text = data.response.toLowerCase();
            return {
                isPhishing: text.includes('true') || text.includes('yes'),
                reason: data.response.replace(/[{}]/g, '').trim()
            };
        }

    } catch (error) {
        console.error("Analysis failed:", error);
        return { isPhishing: false, reason: "Analysis failed: " + error.message };
    }
}

// --- Message Handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyze_email') {
        console.log("Received analysis request for tab:", sender.tab.id);

        (async () => {
            try {
                // 1. Capture Screenshot
                const screenshot = await captureVisibleTabPromise();

                // 2. Call Ollama
                const analysis = await analyzeWithOllama(message.text, screenshot);

                // 3. Return Result
                sendResponse(analysis);

            } catch (error) {
                console.error("Error in analysis pipeline:", error);
                sendResponse({ isPhishing: false, reason: "Internal error" });
            }
        })();

        return true; // Keep channel open for async response
    }
});

console.log("Gmail Phishing Protector: Background service worker loaded.");
