import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import json
import os

SCREENSHOTS = Path("/tmp/browser/atis_audit")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        # Using a standard viewport to match user screenshots if possible, but keeping standard 1280x1800 for stability
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Handle Supabase Auth Injection
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        
        await page.goto("http://localhost:8080", wait_until="networkidle")
        
        if storage_key and session_json:
            print(f"Injecting session for key: {storage_key}")
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
            await page.goto("http://localhost:8080/atis", wait_until="networkidle")
        else:
            print("No auth session injected. Navigating to /atis (might redirect to /admin)")
            await page.goto("http://localhost:8080/atis", wait_until="networkidle")

        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(SCREENSHOTS / "atis_dashboard.png"))
        print("Dashboard URL:", page.url)

        # Look for the Connect button and its state
        connect_btn = page.get_by_role("button", name="Conectar")
        if await connect_btn.is_visible():
             print("Connect button found")
             await connect_btn.screenshot(path=str(SCREENSHOTS / "connect_button.png"))
        else:
             print("Connect button not found in initial view")

        # Take a look at the console logs for any 'atis-instance' errors
        logs = await page.evaluate("window.console_logs || []") # If we had a logger, but we'll check output
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
