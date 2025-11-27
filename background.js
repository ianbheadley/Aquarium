
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

// --- Badge Management ---
function setBadge(text, color = '#3b82f6') {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}

// --- Analysis ---
async function analyzeWithOllama(text, screenshotDataUrl, sender, links) {
    const config = await getOllamaConfig();
    const base64Image = screenshotDataUrl.split(',')[1];

    // Format the list of links for the prompt
    const linksList = links && links.length > 0 ? links.join(', ') : "No links found";
    const senderStr = sender ? `Name: "${sender.name}", Email: "${sender.email}"` : "Unknown";

    const prompt = `You are a cybersecurity expert. Analyze this email for phishing.

DATA:
- Sender: ${senderStr}
- Links present in body: [${linksList}]
- Email Text Start: "${text.replace(/\n/g, ' ').substring(0, 300)}..."

INSTRUCTIONS:
Perform a Step-by-Step analysis:
1. SENDER CHECK: Does the sender's email domain match the company they claim to be (in the text/screenshot)? (e.g. "Amazon Support" using @gmail.com is PHISHING).
2. LINK CHECK: Do the links point to the official domain of the sender? (e.g. claiming "Netflix" but linking to "update-netflix-account.com" is PHISHING).
3. URGENCY CHECK: Is there artificial urgency (e.g. "Account suspended", "24 hours to reply")?

DECISION RULES:
- IF Sender Domain is generic (@gmail, @yahoo) but claims to be a big corporation -> PHISHING (YES).
- IF Links go to suspicious domains unrelated to the sender -> PHISHING (YES).
- IF Branding looks legitimate AND links go to the official domain -> SAFE (NO).

Respond STRICTLY in JSON:
{
    "isPhishing": boolean,
    "reason": "Concise explanation focusing on the specific mismatch (Sender/Link/Content)."
}`;

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
        setBadge("...", "#fbbf24"); // Yellow for processing

        (async () => {
            try {
                // 1. Capture Screenshot
                const screenshot = await captureVisibleTabPromise();

                // 2. Call Ollama with enhanced data
                const analysis = await analyzeWithOllama(
                    message.text,
                    screenshot,
                    message.sender,
                    message.links
                );

                // 3. Update Badge
                if (analysis.isPhishing) {
                    setBadge("WARN", "#ef4444"); // Red
                } else {
                    setBadge("SAFE", "#10b981"); // Green
                }

                // 4. Return Result
                sendResponse(analysis);

            } catch (error) {
                console.error("Error in analysis pipeline:", error);
                setBadge("ERR", "#64748b"); // Gray
                sendResponse({ isPhishing: false, reason: "Internal error" });
            }
        })();

        return true; // Keep channel open for async response
    }
});

// Initialize Badge
setBadge("ON", "#3b82f6"); // Blue
console.log("Gmail Phishing Protector: Background service worker loaded.");
