# Verificación Pre-Commit

Este proyecto incluye scripts de verificación para detectar errores de sintaxis y tipos antes de hacer commit.

## Scripts Disponibles

### `npm run check`
Ejecuta todas las verificaciones (tipos y sintaxis).

### `npm run check:types`
Solo verifica los tipos de TypeScript sin compilar.

### `npm run check:build`
Solo verifica la sintaxis compilando el proyecto (más rápido que el build completo).

### `npm run precommit`
Ejecuta el script completo de verificación previa (recomendado antes de cada commit).

## Uso Recomendado

Antes de hacer commit, ejecuta:

```bash
npm run precommit
```

O simplemente:

```bash
npm run check
```

## Pre-Commit Hook (Ya Configurado ✅)

El hook de pre-commit **ya está configurado automáticamente** en este proyecto. Se ejecutará cada vez que intentes hacer un commit con `git commit`.

### ¿Qué hace el hook?

- Se ejecuta automáticamente antes de cada commit
- Verifica tipos de TypeScript
- Verifica sintaxis del código
- Si encuentra errores, **bloquea el commit** y muestra los errores
- Si todo está bien, permite que el commit continúe

### Desactivar temporalmente el hook

Si necesitas hacer un commit sin verificación (no recomendado), puedes usar:

```bash
git commit --no-verify
```

### Reconfigurar el hook (si es necesario)

El hook está en `.git/hooks/pre-commit`. Si necesitas recrearlo:

```bash
# En Windows (Git Bash)
chmod +x .git/hooks/pre-commit

# El hook ejecuta: npm run precommit
```

## Qué Verifica

1. **Tipos de TypeScript**: Verifica que no haya errores de tipos usando `tsc --noEmit`
2. **Sintaxis**: Compila el proyecto con Next.js para detectar errores de sintaxis como paréntesis faltantes, llaves mal cerradas, etc.

## Nota

El script `check:build` usa `--no-lint` para ser más rápido, pero si quieres también verificar el linter, puedes ejecutar:

```bash
npm run lint
```
