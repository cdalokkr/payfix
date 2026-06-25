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

    const imageUrl = 'https://payfix-git-develop-corebitdigital.vercel.app/avatars/default-male.png';
    console.log(`Navigating to ${imageUrl}...`);
    
    try {
        const response = await page.goto(imageUrl, { waitUntil: 'networkidle0' });
        if (response) {
            console.log(`Image navigation status: ${response.status()}`);
            console.log(`Content-Type: ${response.headers()['content-type']}`);
            console.log(`Content-Length: ${response.headers()['content-length']}`);
        }
    } catch (err: any) {
        console.error("Navigation error:", err.message);
    }

    // Also navigate to the dashboard page to see why it fails there
    const pageUrl = 'https://payfix-git-develop-corebitdigital.vercel.app/employee';
    console.log(`Navigating to ${pageUrl}...`);
    try {
        const response = await page.goto(pageUrl, { waitUntil: 'networkidle2' });
        console.log(`Dashboard page navigation status: ${response?.status()}`);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get all image tags and their src and check if they loaded
        const imgStates = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map(img => ({
                src: img.src,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                complete: img.complete,
                alt: img.alt
            }));
        });
        console.log("Images on dashboard page:", imgStates);
    } catch (err: any) {
        console.error("Dashboard navigation error:", err.message);
    }

    await browser.close();
}

diagnose().catch(console.error);
