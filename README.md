# Gemini Phishing Site Checker (Demo)
This Chrome extension uses the Gemini API (analyzing both URL and a screenshot of the webpage) to check if a visited site might be a phishing attempt. It includes a caching mechanism to optimize API usage and provides user alerts for suspicious sites. This is a proof-of-concept demonstration.

## Setup Instructions

### Loading the Extension in Chrome

1.  **Download or Clone the Repository:**
    *   Download the extension files as a ZIP archive and extract them to a local folder.
    *   Alternatively, clone the repository using Git: `git clone <repository_url>`

2.  **Open Chrome Extensions Page:**
    *   Open Google Chrome.
    *   Type `chrome://extensions` in the address bar and press Enter.

3.  **Enable Developer Mode:**
    *   In the top right corner of the Extensions page, toggle the "Developer mode" switch to the ON position.

4.  **Load the Unpacked Extension:**
    *   Click the "Load unpacked" button that appears after enabling Developer mode.
    *   Navigate to the directory where you extracted or cloned the extension files.
    *   Select the folder containing the `manifest.json` file and click "Select Folder".

The extension should now be loaded and visible in your list of Chrome extensions.

### Obtaining a Gemini API Key

1.  **Visit Google AI Studio:**
    *   Go to [https://aistudio.google.com/](https://aistudio.google.com/).
2.  **Create or Sign In:**
    *   Sign in with your Google account. If you don't have one, you'll need to create it.
3.  **Get API Key:**
    *   Once signed in, look for an option like "Get API key" or "Create API key".
    *   Follow the on-screen instructions to generate a new API key.
    *   **Important:** Copy this API key and store it in a safe place. You will need it for the extension.

### Configuring the Gemini API Key in the Extension

1.  **Open Extension Options:**
    *   Find the "Gemini Phishing Site Checker (Demo)" extension in your `chrome://extensions` list.
    *   Click on the "Details" button for the extension.
    *   Look for "Extension options" and click on it. (Alternatively, you might be able to right-click the extension icon in the Chrome toolbar and find an "Options" menu).

2.  **Enter API Key:**
    *   In the extension's options page, you will see a field labeled "Enter your Gemini API Key".
    *   Paste the API key you obtained from Google AI Studio into this field.

3.  **Save Settings:**
    *   Click the "Save" or "Apply" button to store your API key.

The extension is now configured to use your Gemini API key and should be operational.

## How it Works

The Gemini Phishing Site Checker (Demo) employs a multi-faceted approach to detect potential phishing websites:

1.  **URL and Screenshot Analysis:**
    *   When you navigate to a new webpage, the extension automatically captures the current URL.
    *   It then takes a screenshot of the visible part of the webpage.
    *   Both the URL and the screenshot data are sent to the Gemini API for analysis. The API is prompted to determine if the site exhibits characteristics of a phishing attempt based on these two inputs.

2.  **Caching Mechanism:**
    *   To optimize performance and reduce redundant API calls (which can incur costs and rate limits), the extension implements a caching system.
    *   When a site is analyzed, its URL and the API's verdict (e.g., "SAFE" or "PHISHING") are stored locally.
    *   If you revisit a site that's already in the cache, the extension uses the cached result instead of making a new API request.
    *   The cache has an expiration period (e.g., 24 hours), after which entries are considered stale and the site will be re-analyzed upon the next visit. This ensures that the information remains relatively current.

3.  **On-Page Alert System:**
    *   If the Gemini API analysis (or a cached result) indicates that a site is potentially a phishing attempt, the extension will trigger an on-page alert.
    *   This alert is typically a prominent visual notification (e.g., a red banner or modal) displayed directly on the suspicious webpage, warning you of the potential danger.
    *   The alert aims to immediately inform you before you interact further with a potentially malicious site.

4.  **Configurable API Key:**
    *   The extension requires a Gemini API key to function, as all analysis requests are processed through the Gemini API.
    *   You need to obtain your own API key from Google AI Studio.
    *   The extension provides an options page where you can securely enter and save your API key. This ensures that the extension is authenticated to use the API under your account.
