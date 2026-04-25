# 🗳️ Sistema RRV (Recuento Rápido de Votos)

## 📌 Descripción
El sistema RRV procesa resultados preliminares en tiempo real a partir de imágenes de actas electorales enviadas desde los recintos.

Permite obtener una visualización temprana de los resultados con baja latencia y alta disponibilidad.

## 🚀 Funcionalidades
- Recepción de imágenes de actas
- Procesamiento OCR para extracción de datos
- Validación básica (estructura, duplicados)
- Integración con SMS para zonas sin conectividad
- Publicación de resultados en tiempo real

## 🧠 Arquitectura
- Arquitectura basada en microservicios
- CQRS para separación lectura/escritura
- Event Sourcing para persistencia de eventos
- Procesamiento asíncrono

## ⚡ Características clave
- Baja latencia
- Alta concurrencia
- Consistencia eventual
- Tolerancia a fallos

## 📡 Flujo
1. Usuario envía imagen (app/web/SMS)
2. Sistema procesa imagen (OCR)
3. Se validan datos
4. Se almacenan como eventos
5. Se actualiza vista de resultados

## 🔒 Seguridad
- Validación de origen de datos
- Control de duplicados
- Logs de auditoría
