#!/usr/bin/env node

/**
 * Script de verificación previa antes de commit
 * Verifica errores de TypeScript y sintaxis
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Verificando código antes de commit...\n');

let hasErrors = false;

// 1. Verificar tipos de TypeScript
console.log('1️⃣ Verificando tipos de TypeScript...');
try {
  execSync('npx tsc --noEmit', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Tipos de TypeScript OK\n');
} catch (error) {
  console.error('❌ Errores de tipos encontrados\n');
  hasErrors = true;
}

// 2. Verificar sintaxis con Next.js build (solo compilación, sin lint)
console.log('2️⃣ Verificando sintaxis con Next.js...');
try {
  execSync('npm run check:build', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Sintaxis OK\n');
} catch (error) {
  console.error('❌ Errores de sintaxis encontrados\n');
  hasErrors = true;
}

if (hasErrors) {
  console.error('❌ Se encontraron errores. Por favor, corrígelos antes de hacer commit.');
  process.exit(1);
} else {
  console.log('✅ Todo OK. Puedes hacer commit con confianza.');
  process.exit(0);
}
