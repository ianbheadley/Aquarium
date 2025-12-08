# Aquarium V1
**Privacy-first credential-phishing prevention tool.**

Aquarium detects phishing attempts on credential forms (password/email inputs) using a hybrid detection stack: local AI (Ollama) + privacy-preserving rules.

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/ianbheadley/Aquarium.git
    cd Aquarium
    ```

2.  **Install & Configure Ollama:**
    *   Install Ollama from [ollama.com](https://ollama.com).
    *   Pull the default model:
        ```bash
        ollama pull qwen2.5-vl:7b
        ```
    *   **Crucial:** Set the `OLLAMA_ORIGINS` environment variable to allow the extension to talk to Ollama.
        ```bash
        export OLLAMA_ORIGINS="chrome-extension://*"
        ollama serve
        ```

3.  **Load Extension:**
    *   Open Chrome and go to `chrome://extensions`.
    *   Enable "Developer Mode".
    *   Click "Load Unpacked" and select the `Aquarium` folder.

## Usage

1.  **Configuration:**
    *   Click the extension icon or go to the Options page.
    *   Select Privacy Mode (Max Privacy = Local Only).
    *   Verify Ollama connection with the "Test" button.
    *   (Optional) Enter a Vertex AI (Gemini) API key for cloud fallback.

2.  **Protection:**
    *   Navigate to any login page. Aquarium will detect the form and analyze the page.
    *   If phishing is detected, a full-screen red shield will block access.
    *   You can "Trust" the page to bypass (adds to local safelist).

## Architecture

*   **Manifest V3**: Secure, event-driven service worker.
*   **Local AI**: Connects to `localhost:11434` for privacy.
*   **Privacy Routing**: Ultra-sensitive domains (banking, email) are forced to local analysis.
*   **Data Capture**: Captures page text and screenshots (resized in offscreen document) for multimodal analysis.

## Development

*   **Tests**: Run unit tests with `npm test`.
