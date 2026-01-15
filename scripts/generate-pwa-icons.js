/**
 * Generate PWA icons in multiple sizes
 * Run with: node scripts/generate-pwa-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SOURCE_ICON = path.join(ICONS_DIR, 'icon-512x512.png');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    // Ensure icons directory exists
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    // Check if source icon exists
    if (!fs.existsSync(SOURCE_ICON)) {
        console.error('Source icon not found at:', SOURCE_ICON);
        console.log('Please add a 512x512 PNG icon first.');
        process.exit(1);
    }

    console.log('Generating PWA icons from:', SOURCE_ICON);

    for (const size of SIZES) {
        const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

        try {
            await sharp(SOURCE_ICON)
                .resize(size, size)
                .png()
                .toFile(outputPath);

            console.log(`✓ Generated: icon-${size}x${size}.png`);
        } catch (error) {
            console.error(`✗ Failed to generate icon-${size}x${size}.png:`, error.message);
        }
    }

    // Also generate badge icon for notifications
    const badgePath = path.join(ICONS_DIR, 'badge-72x72.png');
    try {
        await sharp(SOURCE_ICON)
            .resize(72, 72)
            .png()
            .toFile(badgePath);
        console.log('✓ Generated: badge-72x72.png');
    } catch (error) {
        console.error('✗ Failed to generate badge:', error.message);
    }

    console.log('\nDone! Icons generated in:', ICONS_DIR);
}

generateIcons().catch(console.error);
