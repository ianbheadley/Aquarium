
from playwright.sync_api import sync_playwright, expect
import os
import time

def verify_banner_injection():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the mock Gmail page
        mock_path = os.path.abspath("verification/mock_gmail.html")
        page.goto(f"file://{mock_path}")

        # Wait for the banner to appear (it has a slight timeout in the mock script)
        page.wait_for_selector("#gmail-phishing-protector-banner")

        # Verify banner content
        expect(page.locator("#gmail-phishing-protector-banner")).to_be_visible()
        expect(page.get_by_text("Potential Phishing Detected")).to_be_visible()
        expect(page.get_by_text("Mock Phishing Reason")).to_be_visible()

        # Take screenshot
        page.screenshot(path="verification/banner_injection.png")
        print("Banner injection screenshot captured.")

        browser.close()

if __name__ == "__main__":
    verify_banner_injection()
