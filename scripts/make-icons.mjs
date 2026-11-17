// Generates the app icons (PNG + SVG) without any image dependencies.
// Four coloured players around a star on a dark-blue background.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [0x1d, 0x2b, 0x53];
const DOTS = [
  { x: 0.32, y: 0.32, c: [0xef, 0x47, 0x6f] },
  { x: 0.68, y: 0.32, c: [0x11, 0x8a, 0xb2] },
  { x: 0.32, y: 0.68, c: [0x06, 0xd6, 0xa0] },
  { x: 0.68, y: 0.68, c: [0xff, 0xd1, 0x66] },
];
const R = 0.14;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function pixel(u, v, px) {
  let col = BG;
  for (const d of DOTS) {
    const dist = Math.hypot(u - d.x, v - d.y);
    const ring = Math.hypot(u - d.x, v - d.y) - R;
    if (ring < 0) {
      // white outline
      col = ring > -0.022 ? [255, 255, 255] : d.c;
      const aa = Math.min(1, -ring / px);
      col = col.map((ch, i) => Math.round(ch * aa + BG[i] * (1 - aa)));
      void dist;
    }
  }
  return col;
}

function png(size) {
  const row = size * 3 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size, 1 / size);
      raw.set([r, g, b], y * row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(new URL(name, OUT), png(size));
}

const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${hex(BG)}"/>${DOTS.map(
  (d) => `<circle cx="${d.x * 100}" cy="${d.y * 100}" r="${R * 100}" fill="${hex(d.c)}" stroke="#fff" stroke-width="2.2"/>`,
).join('')}</svg>\n`;
writeFileSync(new URL('icon.svg', OUT), svg);
console.log('icons written to public/icons');
