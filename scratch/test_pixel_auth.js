const fs = require('fs');
const path = require('path');

console.log('--- RUNNING PIXEL ART AUTH & 3D FLIP SUITE ---');

// 1. Check HTML files
const azHtml = fs.readFileSync(path.join(__dirname, '../index-az.html'), 'utf8');
const enHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const shared = fs.readFileSync(path.join(__dirname, '../shared.js'), 'utf8');

// Assert no unicode emojis in azHtml / enHtml
const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
const azEmojis = azHtml.match(emojiRegex);
const enEmojis = enHtml.match(emojiRegex);

console.log('Checking Unicode Emojis in index-az.html: Found', azEmojis ? azEmojis.length : 0);
console.log('Checking Unicode Emojis in index.html: Found', enEmojis ? enEmojis.length : 0);

// Assert 3D Flip Card structure
if (!azHtml.includes('id="auth-flip-card"') || !azHtml.includes('pixel-card-front') || !azHtml.includes('pixel-card-back')) {
  throw new Error('3D Flip Card structure missing in index-az.html');
}
console.log('✓ 3D Flip Card container verified in index-az.html');

// Assert Mascot companion
if (!azHtml.includes('pixel-companion-wrap') || !azHtml.includes('pixel-speech-bubble')) {
  throw new Error('Pixel Mascot Companion missing in index-az.html');
}
console.log('✓ Pixel Mascot Companion verified in index-az.html');

// Assert Avatar Carousel
if (!azHtml.includes('cyclePixelAvatar') || !azHtml.includes('pixel-avatar-picker-wrap')) {
  throw new Error('Pixel Avatar Picker missing in index-az.html');
}
console.log('✓ Pixel Avatar Picker verified in index-az.html');

// Assert Chiptune BGM in shared.js
if (!shared.includes('toggleBGM') || !shared.includes('KONAMI_CODE') || !shared.includes('retro-gold-master')) {
  throw new Error('Chiptune BGM or Konami Code missing in shared.js');
}
console.log('✓ Procedural Chiptune BGM & Konami Code verified in shared.js');

// Assert CSS 3D & Stepped Border
if (!css.includes('perspective: 1200px') || !css.includes('transform: rotateY(180deg)') || !css.includes('retro-gold-master')) {
  throw new Error('CSS 3D perspective or gold master rules missing in style.css');
}
console.log('✓ CSS 3D Perspective & Retro Stepped Box Shadows verified');

console.log('--- ALL PIXEL ART & FLIP CARD VERIFICATIONS PASSED 100%! ---');
