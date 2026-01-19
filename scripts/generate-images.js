/**
 * Script para generar iconos PNG desde el SVG
 * 
 * Para ejecutar manualmente (si tienes sharp instalado):
 * node scripts/generate-images.js
 * 
 * De lo contrario, puedes usar herramientas online como:
 * - https://cloudconvert.com/svg-to-png
 * - https://www.svgtopng.com/
 * 
 * Tamaños recomendados:
 * - icon-192.png: 192x192 (PWA manifest)
 * - icon-512.png: 512x512 (PWA manifest)
 * - apple-touch-icon.png: 180x180 (iOS)
 * - og-image.png: 1200x630 (Open Graph para redes sociales)
 * - favicon-32.png: 32x32 (fallback favicon)
 * - favicon-16.png: 16x16 (fallback favicon)
 */

const fs = require('fs');
const path = require('path');

// SVG content for icon
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.9"/>
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="102" fill="url(#bgGrad)"/>
  <rect x="100" y="280" width="70" height="140" rx="12" fill="url(#barGrad)"/>
  <rect x="221" y="200" width="70" height="220" rx="12" fill="url(#barGrad)"/>
  <rect x="342" y="120" width="70" height="300" rx="12" fill="url(#barGrad)"/>
  <text x="256" y="95" font-size="48" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Arial, sans-serif" font-weight="bold">$</text>
</svg>`;

// SVG content for Open Graph image (1200x630)
const ogImageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGradOG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradOG)"/>
  
  <!-- Decorative circles -->
  <circle cx="1100" cy="100" r="200" fill="rgba(255,255,255,0.05)"/>
  <circle cx="100" cy="530" r="150" fill="rgba(255,255,255,0.05)"/>
  
  <!-- Icon representation -->
  <g transform="translate(80, 165)">
    <rect width="300" height="300" rx="60" fill="rgba(255,255,255,0.15)"/>
    <rect x="50" y="175" width="45" height="85" rx="8" fill="white"/>
    <rect x="127" y="125" width="45" height="135" rx="8" fill="white"/>
    <rect x="205" y="75" width="45" height="185" rx="8" fill="white"/>
  </g>
  
  <!-- Text -->
  <text x="450" y="280" font-size="72" font-weight="bold" fill="white" font-family="system-ui, -apple-system, sans-serif">FinControl</text>
  <text x="450" y="350" font-size="32" fill="rgba(255,255,255,0.9)" font-family="system-ui, -apple-system, sans-serif">Controlá tus finanzas personales</text>
  <text x="450" y="400" font-size="24" fill="rgba(255,255,255,0.7)" font-family="system-ui, -apple-system, sans-serif">Gastos • Ingresos • Ahorros • Proyecciones</text>
  
  <!-- URL -->
  <text x="450" y="500" font-size="20" fill="rgba(255,255,255,0.5)" font-family="system-ui, -apple-system, sans-serif">fin.nexuno.com.ar</text>
</svg>`;

console.log('📦 Iconos SVG generados.');
console.log('');
console.log('Para convertir a PNG, usa una de estas opciones:');
console.log('');
console.log('1. Herramientas online gratuitas:');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('   - https://www.svgtopng.com/');
console.log('');
console.log('2. O instala sharp y ejecuta este script:');
console.log('   npm install sharp');
console.log('   node scripts/generate-images.js');
console.log('');
console.log('Archivos necesarios en /public:');
console.log('   - icon-192.png (192x192)');
console.log('   - icon-512.png (512x512)');  
console.log('   - apple-touch-icon.png (180x180)');
console.log('   - og-image.png (1200x630)');

// Si sharp está instalado, generar los PNGs
try {
  const sharp = require('sharp');
  
  const publicDir = path.join(__dirname, '..', 'public');
  
  const sizes = [
    { name: 'icon-192.png', width: 192, height: 192, svg: iconSvg },
    { name: 'icon-512.png', width: 512, height: 512, svg: iconSvg },
    { name: 'apple-touch-icon.png', width: 180, height: 180, svg: iconSvg },
    { name: 'og-image.png', width: 1200, height: 630, svg: ogImageSvg },
  ];
  
  sizes.forEach(async ({ name, width, height, svg }) => {
    try {
      await sharp(Buffer.from(svg))
        .resize(width, height)
        .png()
        .toFile(path.join(publicDir, name));
      console.log(`✅ Generado: ${name}`);
    } catch (err) {
      console.error(`❌ Error generando ${name}:`, err.message);
    }
  });
} catch (e) {
  // sharp no está instalado, solo mostrar instrucciones
}
