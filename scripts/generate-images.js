const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Crear directorio public si no existe
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// SVG del logo
const logoSvg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Fondo -->
  <rect width="512" height="512" rx="128" fill="url(#grad)"/>

  <!-- Logo centrado -->
  <g transform="translate(156, 156)">
    <rect x="0" y="90" width="40" height="120" rx="8" fill="white"/>
    <rect x="80" y="60" width="40" height="150" rx="8" fill="white"/>
    <rect x="160" y="30" width="40" height="180" rx="8" fill="white"/>
    <path d="M -5 105 L 45 75 L 105 45 L 190 5" stroke="white" stroke-width="12" fill="none" stroke-linecap="round"/>
    <circle cx="190" cy="5" r="16" fill="white"/>
  </g>
</svg>
`;

// SVG de Open Graph
const ogSvg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Fondo -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>

  <!-- Patrón de fondo sutil -->
  <g opacity="0.1">
    <circle cx="200" cy="100" r="100" fill="white"/>
    <circle cx="1000" cy="500" r="150" fill="white"/>
    <circle cx="100" cy="550" r="80" fill="white"/>
  </g>

  <!-- Logo -->
  <g transform="translate(100, 150)">
    <circle cx="80" cy="80" r="70" fill="white" opacity="0.2"/>
    <g fill="white">
      <rect x="50" y="90" width="15" height="45" rx="3"/>
      <rect x="80" y="75" width="15" height="60" rx="3"/>
      <rect x="110" y="60" width="15" height="75" rx="3"/>
      <path d="M 45 100 L 65 85 L 87 70 L 120 50" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="120" cy="50" r="6" fill="white"/>
    </g>
  </g>

  <!-- Texto -->
  <text x="300" y="270" font-family="Arial, sans-serif" font-size="96" font-weight="bold" fill="white">
    FinControl
  </text>

  <text x="300" y="350" font-family="Arial, sans-serif" font-size="42" font-weight="400" fill="white" opacity="0.95">
    Controlá tus Finanzas
  </text>

  <text x="300" y="420" font-family="Arial, sans-serif" font-size="28" font-weight="300" fill="white" opacity="0.85">
    Plataforma profesional para gestionar gastos,
  </text>
  <text x="300" y="460" font-family="Arial, sans-serif" font-size="28" font-weight="300" fill="white" opacity="0.85">
    proyecciones, ahorros y patrimonio
  </text>

  <!-- Línea decorativa -->
  <rect x="300" y="490" width="120" height="4" fill="white" opacity="0.6" rx="2"/>
</svg>
`;

async function generateImages() {
  try {
    console.log('Generando imágenes...');

    // Generar icon-192.png
    await sharp(Buffer.from(logoSvg))
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✅ icon-192.png creado');

    // Generar icon-512.png
    await sharp(Buffer.from(logoSvg))
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✅ icon-512.png creado');

    // Generar og-image.png
    await sharp(Buffer.from(ogSvg))
      .png()
      .toFile(path.join(publicDir, 'og-image.png'));
    console.log('✅ og-image.png creado');

    // Generar apple-touch-icon.png (180x180)
    await sharp(Buffer.from(logoSvg))
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✅ apple-touch-icon.png creado');

    console.log('🎉 ¡Todas las imágenes generadas exitosamente!');
  } catch (error) {
    console.error('Error generando imágenes:', error);
    process.exit(1);
  }
}

generateImages();
