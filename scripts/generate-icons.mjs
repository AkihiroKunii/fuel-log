// PWAアイコン生成(初回のみ実行し、生成物は public/icons/ にコミットする)
// 使い方: npm run icons
// モチーフ: しずく(燃料)+ 右上がりの折れ線。maskableでも主要素が切れないよう中央60%に収めている。
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.32" r="0.8">
      <stop offset="0" stop-color="#172038"/>
      <stop offset="1" stop-color="#0b1120"/>
    </radialGradient>
    <linearGradient id="drop" x1="0.1" y1="1" x2="0.9" y2="0">
      <stop offset="0" stop-color="#3987e5"/>
      <stop offset="1" stop-color="#5aa2f2"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#eaf4ff"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <path d="M210 171 C168 227 130 275 130 315 A80 80 0 0 0 290 315 C290 275 252 227 210 171 Z" fill="url(#drop)"/>
  <polyline points="300,202 344,194 396,132" fill="none" stroke="url(#line)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="396" cy="132" r="17" fill="#ffffff"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });
const buf = Buffer.from(svg);
await sharp(buf).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(buf).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(buf).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
console.log('public/icons/ にアイコンを生成しました');
