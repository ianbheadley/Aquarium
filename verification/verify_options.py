
from playwright.sync_api import sync_playwright, expect
import os

def verify_options_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the options page from the local file
        options_path = os.path.abspath("options.html")
        page.goto(f"file://{options_path}")

        # Verify title
        expect(page).to_have_title("Gmail Phishing Protector Settings")

        # Verify inputs
        expect(page.locator("#ollamaEndpoint")).to_be_visible()
        expect(page.locator("#ollamaModel")).to_be_visible()
        expect(page.locator("#save")).to_be_visible()

        # Take screenshot
        page.screenshot(path="verification/options_page.png")
        print("Options page screenshot captured.")

        browser.close()

if __name__ == "__main__":
    verify_options_page()
