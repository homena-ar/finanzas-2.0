# Cómo hacer que WhatsApp muestre la imagen

WhatsApp tiene un caché MUY agresivo. Aquí está cómo solucionarlo:

## ✅ Funciona en Facebook - No en WhatsApp

Esto es NORMAL. WhatsApp cachea las previews por **días o semanas**.

## 🔧 Soluciones (en orden de efectividad):

### 1. **Usar parámetro único** (MÁS FÁCIL)
Compartí la URL con un parámetro único:
```
https://app.nexuno.com.ar/?v=123
```
Cambiá el número cada vez. WhatsApp lo verá como URL nueva.

### 2. **Borrar caché de WhatsApp** (Android)
```bash
Configuración de WhatsApp → Almacenamiento y datos → Administrar almacenamiento → Borrar caché
```

### 3. **Borrar caché de WhatsApp** (iPhone)
```bash
Desinstalar y reinstalar WhatsApp (última opción)
```

### 4. **Esperar** (Menos recomendado)
WhatsApp actualiza su caché cada 7-30 días automáticamente.

## 🎯 Prueba rápida:

1. Compartí: `https://app.nexuno.com.ar/?test=1`
2. Si sigue sin imagen, cambiá a: `?test=2`, `?test=3`, etc.
3. Probá en un chat diferente (el caché es por chat)

## ⚠️ Importante:

- Facebook actualiza inmediatamente con el debugger
- WhatsApp NO tiene debugger público
- WhatsApp cachea POR CHAT (probá en otro chat)
- La imagen SÍ está funcionando (lo probaste en Facebook)

## 📱 Alternativa definitiva:

Compartí la URL desde el navegador móvil (no desde la app):
1. Abrí Chrome/Safari en el celular
2. Andá a `https://app.nexuno.com.ar`
3. Botón "Compartir" del navegador → WhatsApp
4. El navegador fuerza el refresh

---

**TL;DR:** Usá `?v=1` al final de la URL y va a funcionar.
