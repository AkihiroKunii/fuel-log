// PWAアイコン生成(初回のみ実行し、生成物は public/icons/ にコミットする)
// 使い方: npm run icons
// モチーフ: しずく(燃料)の中に右上がりの折れ線(燃費の推移)。
// 背景は全面塗り(角丸・透過なし)。iOS も Android(maskable)も OS 側でマスクするため、
// 透過の角があると黒く出てしまう。主要素は maskable の安全領域(中央の直径80%の円)に収めている。
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.3" r="0.85">
      <stop offset="0" stop-color="#1b2a4a"/>
      <stop offset="1" stop-color="#0b1120"/>
    </radialGradient>
    <linearGradient id="drop" x1="0.15" y1="1" x2="0.85" y2="0">
      <stop offset="0" stop-color="#2f78d6"/>
      <stop offset="1" stop-color="#6db0f7"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <path d="M256 92 C200 170 144 236 144 308 A112 112 0 0 0 368 308 C368 236 312 170 256 92 Z" fill="url(#drop)"/>
  <polyline points="188,348 236,306 274,330 328,266" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="328" cy="266" r="17" fill="#ffffff"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });
const buf = Buffer.from(svg);
await sharp(buf).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(buf).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(buf).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
console.log('public/icons/ にアイコンを生成しました');
