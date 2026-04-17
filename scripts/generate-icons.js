const sharp = require('sharp');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'public', 'logo.png');
const OUT_DIR = path.join(__dirname, '..', 'public');

const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

async function generate() {
  for (const { name, size } of SIZES) {
    const outPath = path.join(OUT_DIR, name);
    await sharp(SOURCE).resize(size, size).png().toFile(outPath);
    console.log(`✓ ${name} (${size}x${size})`);
  }
  console.log('Done.');
}

generate().catch(err => { console.error('Error:', err.message); process.exit(1); });
