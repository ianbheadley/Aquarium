# Multi-Model AI Phishing Site Checker
This Chrome extension leverages various Large Language Models (LLMs) – analyzing both the URL and a screenshot of the webpage – to check if a visited site might be a phishing attempt. It supports Gemini, Anthropic (Claude), OpenAI (ChatGPT), and local Ollama instances. The extension includes a caching mechanism to optimize API usage and provides user alerts for suspicious sites.

## Setup Instructions

### 1. Loading the Extension in Chrome

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

The extension should now be loaded and visible in your list of Chrome extensions. Make sure its icon appears in the Chrome toolbar (you might need to pin it from the puzzle-piece Extensions menu).

### 2. Model Configuration

This extension supports multiple AI providers for phishing detection. You need to configure at least one to use the extension. Open the extension's options page by:
* Right-clicking the extension icon in the Chrome toolbar and selecting "Options".
* Or, navigating to `chrome://extensions`, finding the "Multi-Model AI Phishing Site Checker", clicking "Details", and then "Extension options".

On the options page:
1.  **Select Your Model:** Use the "Select Model:" dropdown to choose your preferred AI provider: Gemini, Anthropic (Claude), OpenAI (ChatGPT), or Ollama (Local).
2.  **Enter API Key/Endpoint:** Based on your selection, you'll need to provide an API key or a local endpoint.

Below are details for each supported model:

#### a. Google Gemini
*   **Description:** Uses Google's Gemini family of models.
*   **Requirement:** A Gemini API Key.
*   **Obtaining a Key:**
    1.  Go to [Google AI Studio](https://aistudio.google.com/).
    2.  Sign in and create a new API key.
    3.  Copy the generated key.
*   **Configuration:** Paste your Gemini API key into the "Gemini API Key" field on the extension's options page and click "Save Settings".

#### b. Anthropic (Claude)
*   **Description:** Uses Anthropic's Claude family of models (e.g., Claude 3 Haiku, Sonnet). The extension currently uses `claude-3-haiku-20240307`.
*   **Requirement:** An Anthropic API Key.
*   **Obtaining a Key:**
    1.  Go to the [Anthropic Console](https://console.anthropic.com/).
    2.  Sign up or log in.
    3.  Navigate to the API keys section to create and copy your key.
*   **Configuration:** Paste your Anthropic API key into the "Anthropic (Claude) API Key" field and click "Save Settings".

#### c. OpenAI (ChatGPT)
*   **Description:** Uses OpenAI's GPT models (specifically `gpt-4o` for its multimodal capabilities).
*   **Requirement:** An OpenAI API Key.
*   **Obtaining a Key:**
    1.  Go to the [OpenAI Platform](https://platform.openai.com/).
    2.  Sign up or log in.
    3.  Navigate to the API keys section to create and copy your key.
*   **Configuration:** Paste your OpenAI API key into the "OpenAI (ChatGPT) API Key" field and click "Save Settings".

#### d. Ollama (Local)
*   **Description:** Allows you to use a locally running Ollama instance with a compatible multimodal model (e.g., LLaVA).
*   **Requirements:**
    *   Ollama installed and running on your system.
    *   A multimodal model like LLaVA downloaded and accessible via Ollama (the extension defaults to trying to use a model named "llava").
*   **Setup:**
    1.  **Install Ollama:** Follow the instructions on the [Ollama website](https://ollama.com/).
    2.  **Download a Multimodal Model:** After installing Ollama, run a command like `ollama pull llava` in your terminal to download the LLaVA model.
*   **Configuration:**
    1.  In the extension's options page, enter your Ollama API endpoint into the "Ollama API Endpoint" field. This is typically `http://localhost:11434` if Ollama is running locally with default settings.
    2.  Click "Save Settings".

After configuring your chosen model and API key/endpoint, the extension is ready to operate. You can change models and update keys at any time via the options page. Clicking "Clear All Settings" will remove all entered API keys and the Ollama endpoint, but will not change your currently selected model.

## How it Works

The Multi-Model AI Phishing Site Checker employs a multi-faceted approach to detect potential phishing websites:

1.  **URL and Screenshot Analysis:**
    *   When you navigate to a new webpage, the extension automatically captures the current URL.
    *   It then takes a screenshot of the visible part of the webpage.
    *   Both the URL and the screenshot data are sent to the **selected AI model's API** for analysis. The API is prompted to determine if the site exhibits characteristics of a phishing attempt based on these two inputs.

2.  **Caching Mechanism:**
    *   To optimize performance and reduce redundant API calls (which can incur costs and rate limits for cloud APIs), the extension implements a caching system.
    *   When a site is analyzed, its hostname and the API's verdict (e.g., "safe" or "phishing") along with the reasoning are stored locally.
    *   If you revisit a site (same hostname) that's already in the cache, the extension uses the cached result instead of making a new API request.
    *   The cache helps in faster subsequent checks and reduces API usage. Entries are not currently set to expire automatically but will be overwritten if a site is re-analyzed (e.g., after clearing cache or if cache logic changes).

3.  **On-Page Alert System:**
    *   If the selected AI model's analysis (or a cached result) indicates that a site is potentially a phishing attempt, the extension will trigger an on-page alert.
    *   This alert is a prominent visual notification displayed directly on the suspicious webpage, warning you of the potential danger and providing the reason for the suspicion.
    *   The alert aims to immediately inform you before you interact further with a potentially malicious site.

4.  **Flexible Model Choice:**
    *   The core strength of this version is its ability to use different AI backends.
    *   Users can select their preferred provider based on API access, cost considerations, or desired model capabilities.
    *   The extension handles the specific API request formats for each supported model.
