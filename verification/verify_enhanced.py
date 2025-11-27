
from playwright.sync_api import sync_playwright, expect
import os

def verify_enhanced_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the mock Gmail page
        mock_path = os.path.abspath("verification/mock_gmail.html")
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.goto(f"file://{mock_path}")

        # Wait for the extraction test to log
        page.wait_for_timeout(2000)

        # Verify banner appeared (proving the flow worked)
        expect(page.locator("#gmail-phishing-protector-banner")).to_be_visible()
        expect(page.get_by_text("Sender domain does not match")).to_be_visible()

        # Take screenshot
        page.screenshot(path="verification/enhanced_detection.png")
        print("Enhanced detection screenshot captured.")

        browser.close()

if __name__ == "__main__":
    verify_enhanced_logic()
