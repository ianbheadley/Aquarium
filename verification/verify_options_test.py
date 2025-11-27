
from playwright.sync_api import sync_playwright, expect
import os

def verify_options_test_button():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the options page
        options_path = os.path.abspath("options.html")
        page.goto(f"file://{options_path}")

        # Check if the Test Connection button exists
        expect(page.locator("#testConnection")).to_be_visible()

        # Verify initial state of status
        expect(page.locator("#status")).to_be_empty()

        # We can't actually hit localhost:11434 inside this restricted sandbox environment if Ollama isn't running.
        # So clicking it will likely fail. We just want to see the UI state.

        # Take screenshot of the new UI
        page.screenshot(path="verification/options_test_button.png")
        print("Options page with Test button screenshot captured.")

        browser.close()

if __name__ == "__main__":
    verify_options_test_button()
