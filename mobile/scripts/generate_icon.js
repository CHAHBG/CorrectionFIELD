/**
 * Generate app icon PNGs from SVG for all Android mipmap densities.
 * Uses sharp (installed temporarily).
 */
const fs = require('fs');
const path = require('path');

// SVG logo: land parcel grid + checkmark
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1E40AF"/>
      <stop offset="100%" style="stop-color:#2563EB"/>
    </linearGradient>
    <linearGradient id="green" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#059669"/>
      <stop offset="100%" style="stop-color:#34D399"/>
    </linearGradient>
  </defs>
  
  <!-- Background rounded square -->
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  
  <!-- Land parcel grid -->
  <g opacity="0.35" stroke="white" stroke-width="2" fill="none">
    <!-- Horizontal lines -->
    <line x1="60" y1="170" x2="340" y2="170"/>
    <line x1="60" y1="250" x2="340" y2="250"/>
    <line x1="60" y1="330" x2="340" y2="330"/>
    <line x1="60" y1="410" x2="340" y2="410"/>
    <!-- Vertical lines -->
    <line x1="60" y1="170" x2="60" y2="410"/>
    <line x1="153" y1="170" x2="153" y2="410"/>
    <line x1="247" y1="170" x2="247" y2="410"/>
    <line x1="340" y1="170" x2="340" y2="410"/>
  </g>
  
  <!-- Filled parcel highlight -->
  <rect x="60" y="250" width="93" height="80" fill="white" opacity="0.15" rx="4"/>
  <rect x="153" y="170" width="94" height="80" fill="white" opacity="0.15" rx="4"/>
  
  <!-- Map pin with checkmark -->
  <g transform="translate(320, 80)">
    <!-- Pin body -->
    <path d="M90 0C50 0 16 34 16 74C16 130 90 190 90 190S164 130 164 74C164 34 130 0 90 0Z" fill="url(#green)"/>
    <!-- White circle inside pin -->
    <circle cx="90" cy="74" r="42" fill="white"/>
    <!-- Checkmark -->
    <polyline points="65,74 82,92 115,58" fill="none" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  
  <!-- "CF" text -->
  <text x="130" y="140" font-family="Arial, sans-serif" font-weight="bold" font-size="60" fill="white" opacity="0.9">CF</text>
</svg>
`;

const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
};

async function main() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch {
        console.log('Installing sharp...');
        const { execSync } = require('child_process');
        execSync('npm install sharp --no-save', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
        sharp = require('sharp');
    }

    const resDir = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
    const svgBuffer = Buffer.from(SVG);

    for (const [folder, size] of Object.entries(sizes)) {
        const outDir = path.join(resDir, folder);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // ic_launcher.png (standard)
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(outDir, 'ic_launcher.png'));

        // ic_launcher_round.png (round - just crop to circle via composite)
        const roundMask = Buffer.from(
            `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
        );
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .composite([{ input: roundMask, blend: 'dest-in' }])
            .toFile(path.join(outDir, 'ic_launcher_round.png'));

        console.log(`✓ ${folder}: ${size}x${size}px`);
    }

    // Also save a full-size copy for reference
    await sharp(svgBuffer)
        .resize(512, 512)
        .png()
        .toFile(path.join(resDir, '..', '..', '..', '..', '..', 'icon_512.png'));

    console.log('✓ icon_512.png (full size reference)');
    console.log('\nDone! All icon sizes generated.');
}

main().catch(console.error);
