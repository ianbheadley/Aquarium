# Codebase Review: Gmail Phishing Protector

## Overview
The codebase implements a Chrome Extension named "Gmail Phishing Protector" (v1.0.0). Its primary purpose is to detect phishing attempts within Gmail by analyzing the email content (sender, links, text) and a screenshot of the email using a local AI model (Ollama).

## Architecture

The extension follows the Manifest V3 architecture with the following components:

### 1. Manifest (`manifest.json`)
*   **Permissions**:
    *   `tabs`, `activeTab`, `scripting`: For interacting with pages and taking screenshots.
    *   `storage`: For saving user configurations (Ollama endpoint/model).
*   **Host Permissions**:
    *   `*://mail.google.com/*`: Restricts functionality strictly to Gmail.
    *   `http://localhost/*`: Allows communication with the local Ollama API.
*   **Background**: Uses a service worker (`background.js`).
*   **Content Scripts**: Runs `content.js` only on `mail.google.com`.

### 2. Content Script (`content.js`)
*   **Purpose**: Monitors the Gmail interface, extracts data, and displays warnings.
*   **Detection Mechanism**:
    *   Uses a `MutationObserver` and `hashchange` listener to detect when an email is opened (URLs containing `inbox/`, `category/`, `label/`).
*   **Data Extraction**:
    *   **Sender**: Scrapes sender name and email from specific DOM elements (`span.gD`).
    *   **Links**: Extracts all links from the message body (`.a3s a`).
    *   **Body Text**: Extracts text from the message body (`.a3s`).
*   **Communication**: Sends the extracted data to `background.js` via `chrome.runtime.sendMessage`.
*   **UI**: Injects a warning banner (red box) above the subject line if the background script returns a "Phishing" verdict.

### 3. Background Service Worker (`background.js`)
*   **Purpose**: Orchestrates the analysis.
*   **Workflow**:
    1.  Receives `analyze_email` message from `content.js`.
    2.  Captures a visible tab screenshot using `chrome.tabs.captureVisibleTab`.
    3.  Retrieves configuration (endpoint/model) from `chrome.storage`.
    4.  Constructs a prompt for the AI, including:
        *   Sender Name & Email.
        *   List of Links.
        *   First 300 characters of email text.
        *   Base64 encoded screenshot.
    5.  Sends the prompt to the Ollama API (`/api/generate`).
    6.  Parses the JSON response (heuristically if necessary) and returns the result to `content.js`.

### 4. Options Page (`options.html`, `options.js`)
*   Allows the user to configure the local Ollama API endpoint (default: `http://localhost:11434`) and model name (default: `llava`).

## Key Discrepancies & Observations

1.  **README Mismatch**: The current `README.md` describes a "Gemini Phishing Site Checker" that uses the Google Gemini API in the cloud. The actual code uses **Ollama (Local AI)**. The instructions in the README about API keys and general web navigation are incorrect for this specific codebase.
2.  **Gmail Specificity**: Unlike the README's implication of general web protection, the manifest strictly limits the extension to `mail.google.com`.
3.  **Selectors**: The content script relies on obfuscated Gmail class names (e.g., `.gD`, `.a3s`). These are subject to change by Google at any time, which would break the extraction logic.
4.  **Local AI Dependency**: The extension requires a running instance of Ollama with a vision-capable model (like `llava`) on the user's machine.

## Conclusion
The codebase is a functional Proof-of-Concept for a privacy-focused, local-AI-based phishing detector specifically for Gmail. It completely diverges from the `README.md` description.
