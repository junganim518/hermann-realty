const sharp = require('sharp');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'public', 'logo.png');
const OUT_DIR = path.join(__dirname, '..', 'public');
const BG_COLOR = { r: 26, g: 26, b: 26, alpha: 1 }; // #1a1a1a
const LOGO_RATIO = 0.7;

const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

async function generate() {
  for (const { name, size } of SIZES) {
    const logoSize = Math.round(size * LOGO_RATIO);
    const logo = await sharp(SOURCE).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

    const bg = sharp({
      create: { width: size, height: size, channels: 4, background: BG_COLOR },
    });

    const outPath = path.join(OUT_DIR, name);
    await bg.composite([{ input: logo, gravity: 'centre' }]).png().toFile(outPath);
    console.log(`✓ ${name} (${size}x${size}, logo ${logoSize}x${logoSize})`);
  }
  console.log('Done.');
}

generate().catch(err => { console.error('Error:', err.message); process.exit(1); });
