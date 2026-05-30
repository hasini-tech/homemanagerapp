import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#3b82f6"/>
  <text x="256" y="350" font-size="280" font-weight="bold" text-anchor="middle" fill="white" font-family="system-ui">₹</text>
</svg>`;

const sizes = [96, 192, 512];

async function generateIcons() {
  try {
    console.log('Generating PWA icons...');

    // Generate standard icons
    for (const size of sizes) {
      await sharp(Buffer.from(svgIcon))
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `icon-${size}.png`));
      console.log(`✓ Generated icon-${size}.png`);
    }

    // Generate maskable icons (with extra padding for safe zone)
    for (const size of sizes) {
      const paddedSize = Math.floor(size * 1.2);
      await sharp(Buffer.from(svgIcon))
        .resize(paddedSize, paddedSize)
        .png()
        .toFile(path.join(publicDir, `icon-maskable-${size}.png`));
      console.log(`✓ Generated icon-maskable-${size}.png`);
    }

    console.log('✓ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
