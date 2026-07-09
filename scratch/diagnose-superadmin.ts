import puppeteer from 'puppeteer';

async function diagnose() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Listen to console messages
    page.on('console', msg => {
        console.log(`[BROWSER-CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // Listen to network requests/responses
    page.on('requestfailed', request => {
        console.log(`[REQUEST-FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });

    page.on('response', response => {
        const status = response.status();
        if (status >= 400) {
            console.log(`[RESPONSE-ERROR] ${response.url()} - Status ${status}`);
        }
    });

    console.log("Navigating to login page...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

    console.log("Filling login form...");
    await page.type('input[type="email"]', 'srpadmin@saaskit.in');
    await page.type('input[type="password"]', 'Srpadmin@7626$');

    console.log("Clicking login button...");
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('button[type="submit"]')
    ]);

    const finalUrl = page.url();
    console.log(`Successfully logged in. Final URL: ${finalUrl}`);

    // Wait 2 seconds to make sure the page completes rendering
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the HTML content or some selectors
    const result = await page.evaluate(() => {
        const hasSidebar = !!document.querySelector('aside, [role="navigation"], .sidebar, .border-r');
        const hasHeader = !!document.querySelector('header, .border-b');
        const bodyClass = document.body.className;
        const mainContent = document.body.innerText.substring(0, 500);
        const innerHTML = document.getElementById('__next')?.innerHTML || document.body.innerHTML.substring(0, 1000);
        
        // Find elements with specific ids/classes
        const sidebarEl = document.querySelector('aside');
        const headerEl = document.querySelector('header');
        
        return {
            hasSidebar,
            hasHeader,
            bodyClass,
            sidebarOuterHTML: sidebarEl ? sidebarEl.outerHTML.substring(0, 500) : 'not found',
            headerOuterHTML: headerEl ? headerEl.outerHTML.substring(0, 500) : 'not found',
            mainContent
        };
    });

    console.log("Page Diagnostics:", JSON.stringify(result, null, 2));

    await browser.close();
}

diagnose().catch(console.error);
