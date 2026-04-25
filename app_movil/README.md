# 📱 Aplicación Móvil - Captura de Actas

## 📌 Descripción
Aplicación móvil utilizada por operadores en recintos electorales para capturar imágenes de actas y enviarlas al sistema RRV.

## 🚀 Funcionalidades
- Captura de fotografías
- Envío de imágenes al backend
- Validación básica antes de envío
- Confirmación de recepción
- Modo offline (opcional)

## 🧠 Arquitectura
- Cliente móvil conectado a API RRV
- Manejo de colas para envío diferido
- Integración con servicios backend

## 📡 Flujo
1. Usuario toma foto del acta
2. Se valida calidad básica
3. Se envía al backend
4. Se recibe confirmación

## ⚡ Características
- Uso en baja conectividad
- Interfaz simple
- Alta disponibilidad

## 🔒 Seguridad
- Autenticación de usuario
- Validación de dispositivo
- Encriptación de datos