// cloud.js - Cloud Stub (Gemini)

export const Cloud = {
  async analyze(url, text, screenshotBase64) {
    console.log('Cloud Analysis Triggered for:', url);

    const settings = await chrome.storage.sync.get(['apiKey']);
    const apiKey = settings.apiKey;

    if (!apiKey) {
        console.warn('No Cloud API Key found. Skipping.');
        return { error: 'No API Key' };
    }

    const prompt = `Analyze this phishing suspect. URL: ${url}. Page Text: ${text}. Return JSON: {is_phishing: bool, reason: str, confidence: num}`;

    // Construct the Gemini API request
    // Note: screenshotBase64 needs to be stripped of the data URL prefix if present for some APIs,
    // but Vertex/Gemini usually takes "inlineData".
    // "data:image/jpeg;base64,..." -> split

    let imagePart = null;
    if (screenshotBase64) {
        const base64Data = screenshotBase64.split(',')[1];
        imagePart = {
            inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
            }
        };
    }

    const parts = [{ text: prompt }];
    if (imagePart) parts.push(imagePart);

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }]
            })
        });

        if (!response.ok) {
            throw new Error(`Cloud API Error: ${response.statusText}`);
        }

        const data = await response.json();
        // Parse Gemini response structure
        // Usually data.candidates[0].content.parts[0].text
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        console.log('Cloud Response:', textResponse);

        // Try to parse JSON from the text response
        // Clean up markdown code blocks if present ```json ... ```
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (e) {
        console.error('Cloud analysis failed:', e);
        return { error: e.message };
    }
  }
};
