const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function createPng(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const idatData = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Icon drawer
function getPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Rounded rectangle background
  const radius = 0.22;
  const margin = 0.05;
  const minX = margin, maxX = 1 - margin;
  const minY = margin, maxY = 1 - margin;

  let inCard = false;
  let dist = 0;

  const cx = Math.min(Math.max(nx, minX + radius), maxX - radius);
  const cy = Math.min(Math.max(ny, minY + radius), maxY - radius);
  const dx = nx - cx;
  const dy = ny - cy;
  dist = Math.sqrt(dx * dx + dy * dy);

  if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
    if (dist <= radius) {
      inCard = true;
    }
  }

  if (!inCard) {
    return [0, 0, 0, 0]; // Transparent background
  }

  // Smooth gradient background: Indigo (#4F46E5) to Violet (#7C3AED)
  const grad = ny;
  let bgR = Math.round(79 + (124 - 79) * grad);
  let bgG = Math.round(70 + (58 - 70) * grad);
  let bgB = Math.round(229 + (237 - 229) * grad);

  // Subtle border highlight
  if (dist > radius - 0.03 || nx < minX + 0.03 || nx > maxX - 0.03 || ny < minY + 0.03 || ny > maxY - 0.03) {
    bgR = Math.min(255, bgR + 30);
    bgG = Math.min(255, bgG + 30);
    bgB = Math.min(255, bgB + 30);
  }

  // Document sheet inside (white/cream rectangle with fold)
  const docL = 0.22, docR = 0.78;
  const docT = 0.18, docB = 0.82;
  const foldSize = 0.18;

  if (nx >= docL && nx <= docR && ny >= docT && ny <= docB) {
    // Fold top-right corner check
    const inFoldCut = (nx >= docR - foldSize) && (ny <= docT + foldSize) && ((nx - (docR - foldSize)) + ((docT + foldSize) - ny) > foldSize);
    if (!inFoldCut) {
      // Document interior
      let docR_val = 255, docG_val = 255, docB_val = 255;

      // Inside fold flap
      const inFoldFlap = (nx >= docR - foldSize) && (ny <= docT + foldSize) && ((nx - (docR - foldSize)) <= ((docT + foldSize) - ny));
      if (inFoldFlap && ((nx - (docR - foldSize)) + ((docT + foldSize) - ny) >= foldSize - 0.04)) {
        return [215, 220, 235, 255]; // shadow of fold
      }

      // Markdown "M" mark or text bars
      // Left leg of M
      const isMLeg1 = (nx >= 0.30 && nx <= 0.36 && ny >= 0.35 && ny <= 0.65);
      // Right leg of M
      const isMLeg2 = (nx >= 0.54 && nx <= 0.60 && ny >= 0.35 && ny <= 0.65);
      // Center V of M
      const isMv1 = (nx >= 0.35 && nx <= 0.46 && ny >= 0.35 && ny <= 0.55 && Math.abs((ny - 0.35) / 0.20 - (nx - 0.35) / 0.10) < 0.25);
      const isMv2 = (nx >= 0.44 && nx <= 0.55 && ny >= 0.35 && ny <= 0.55 && Math.abs((ny - 0.35) / 0.20 - (0.55 - nx) / 0.10) < 0.25);

      if (isMLeg1 || isMLeg2 || isMv1 || isMv2) {
        return [67, 56, 202, 255]; // Deep Indigo Markdown mark
      }

      // Downward Arrow (representing conversion to PDF)
      const arrowCenter = 0.68;
      const arrowShaft = (nx >= arrowCenter - 0.03 && nx <= arrowCenter + 0.03 && ny >= 0.38 && ny <= 0.58);
      const dyArrow = ny - 0.58;
      const dxArrow = Math.abs(nx - arrowCenter);
      const arrowHead = (dyArrow >= 0 && dyArrow <= 0.10 && dxArrow <= (0.10 - dyArrow));

      if (arrowShaft || arrowHead) {
        return [220, 38, 38, 255]; // Crimson/Red arrow signifying PDF
      }

      // "PDF" bottom tag strip
      if (ny >= 0.70 && ny <= 0.77 && nx >= 0.30 && nx <= 0.70) {
        return [239, 68, 68, 255]; // Red PDF accent badge
      }

      return [docR_val, docG_val, docB_val, 255];
    }
  }

  return [bgR, bgG, bgB, 255];
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const buf = createPng(size, size, (x, y, w, h) => getPixel(x, y, w, h));
  fs.writeFileSync(path.join(__dirname, 'icons', `icon-${size}.png`), buf);
  console.log(`Generated icon-${size}.png (${buf.length} bytes)`);
}
console.log('All icons generated successfully!');

