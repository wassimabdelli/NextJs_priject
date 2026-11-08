const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Logo SVG stylisé représentant des immeubles modernes (SyndicPro)
const svgLogo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="bldgGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="bldgGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>
  </defs>

  <!-- Fond carré arrondi -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)" />

  <!-- Éléments graphiques : 3 tours/immeubles -->
  <!-- Tour gauche -->
  <rect x="90" y="200" width="90" height="230" rx="8" fill="#1e293b" opacity="0.9" />
  <rect x="110" y="225" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="142" y="225" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="110" y="270" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="142" y="270" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="110" y="315" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="142" y="315" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="110" y="360" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
  <rect x="142" y="360" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />

  <!-- Tour centrale (haute) -->
  <rect x="200" y="110" width="112" height="320" rx="10" fill="url(#bldgGrad2)" />
  <!-- Fenêtres tour centrale -->
  <rect x="220" y="145" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="264" y="145" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="220" y="195" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="264" y="195" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="220" y="245" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="264" y="245" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="220" y="295" width="28" height="32" rx="4" fill="#0284c7" />
  <rect x="264" y="295" width="28" height="32" rx="4" fill="#0284c7" />
  <!-- Porte d'entrée -->
  <rect x="238" y="365" width="36" height="65" rx="4" fill="#0369a1" />

  <!-- Tour droite -->
  <rect x="330" y="170" width="95" height="260" rx="8" fill="url(#bldgGrad1)" />
  <rect x="350" y="200" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="385" y="200" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="350" y="245" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="385" y="245" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="350" y="290" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="385" y="290" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="350" y="335" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
  <rect x="385" y="335" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />

  <!-- Badge / Toit / Aiguille -->
  <polygon points="256,60 252,110 260,110" fill="#38bdf8" />
  <circle cx="256" cy="55" r="7" fill="#38bdf8" />

  <!-- Ligne de sol moderne -->
  <rect x="60" y="425" width="392" height="8" rx="4" fill="#38bdf8" opacity="0.7" />
</svg>
`;

// Version maskable (fond plein sans coins arrondis prédécoupés, avec safe-zone de 20%)
const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="bldgGrad1M" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="bldgGrad2M" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>
  </defs>

  <!-- Fond plein à 100% sans rx pour maskable -->
  <rect width="512" height="512" fill="url(#bgGradM)" />

  <!-- Groupe redimensionné et centré à 75% pour respecter la safe-zone maskable (40px de marge) -->
  <g transform="translate(64, 64) scale(0.75)">
    <!-- Tour gauche -->
    <rect x="90" y="200" width="90" height="230" rx="8" fill="#1e293b" opacity="0.9" />
    <rect x="110" y="225" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="142" y="225" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="110" y="270" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="142" y="270" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="110" y="315" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="142" y="315" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="110" y="360" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />
    <rect x="142" y="360" width="18" height="24" rx="3" fill="#38bdf8" opacity="0.8" />

    <!-- Tour centrale -->
    <rect x="200" y="110" width="112" height="320" rx="10" fill="url(#bldgGrad2M)" />
    <rect x="220" y="145" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="264" y="145" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="220" y="195" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="264" y="195" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="220" y="245" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="264" y="245" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="220" y="295" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="264" y="295" width="28" height="32" rx="4" fill="#0284c7" />
    <rect x="238" y="365" width="36" height="65" rx="4" fill="#0369a1" />

    <!-- Tour droite -->
    <rect x="330" y="170" width="95" height="260" rx="8" fill="url(#bldgGrad1M)" />
    <rect x="350" y="200" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="385" y="200" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="350" y="245" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="385" y="245" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="350" y="290" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="385" y="290" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="350" y="335" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />
    <rect x="385" y="335" width="20" height="26" rx="3" fill="#ffffff" opacity="0.9" />

    <!-- Aiguille -->
    <polygon points="256,60 252,110 260,110" fill="#38bdf8" />
    <circle cx="256" cy="55" r="7" fill="#38bdf8" />

    <!-- Ligne de sol -->
    <rect x="60" y="425" width="392" height="8" rx="4" fill="#38bdf8" opacity="0.7" />
  </g>
</svg>
`;

async function main() {
  fs.writeFileSync(path.join(iconsDir, 'logo.svg'), svgLogo.trim());

  const svgBuf = Buffer.from(svgLogo);
  const maskableBuf = Buffer.from(svgMaskable);

  await sharp(svgBuf).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('✓ icon-192.png généré');

  await sharp(svgBuf).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('✓ icon-512.png généré');

  await sharp(maskableBuf).resize(512, 512).png().toFile(path.join(iconsDir, 'maskable-512.png'));
  console.log('✓ maskable-512.png généré');

  await sharp(svgBuf).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png généré');

  // Copie aussi dans public/apple-touch-icon.png pour compatibilité iOS classique
  await sharp(svgBuf).resize(180, 180).png().toFile(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
  console.log('✓ public/apple-touch-icon.png généré');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
