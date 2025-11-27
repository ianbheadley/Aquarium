
from playwright.sync_api import sync_playwright, expect
import os

def verify_invalidation_handling():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the mock invalidation page
        mock_path = os.path.abspath("verification/mock_invalidation.html")
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.goto(f"file://{mock_path}")

        # Wait for the logic to trigger
        page.wait_for_timeout(1000)

        # Verify the reload banner appeared
        expect(page.locator("#gpp-reload-banner")).to_be_visible()
        expect(page.get_by_text("Please refresh this page")).to_be_visible()

        # Take screenshot
        page.screenshot(path="verification/invalidation_banner.png")
        print("Invalidation banner screenshot captured.")

        browser.close()

if __name__ == "__main__":
    verify_invalidation_handling()
