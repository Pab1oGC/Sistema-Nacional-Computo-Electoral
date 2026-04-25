# 📊 Dashboard de Visualización de Datos Electorales

## 📌 Descripción
El Dashboard de Visualización de Datos permite analizar, comparar y monitorear en tiempo real los resultados del sistema electoral, integrando información del Recuento Rápido de Votos (RRV) y del Cómputo Oficial.

Su objetivo es proporcionar transparencia, detección de inconsistencias y soporte para la toma de decisiones mediante visualizaciones claras e interactivas.

---

## 🎯 Objetivos
- Visualizar resultados preliminares y oficiales  
- Comparar diferencias entre RRV y Cómputo Oficial  
- Detectar anomalías e inconsistencias  
- Mostrar métricas clave del proceso electoral  
- Proveer transparencia al proceso  

---

## 🚀 Funcionalidades

### 📈 Métricas (Datos Crudos)
- Participación electoral  
- Total de votos (válidos, nulos, blancos)  
- Votos por candidato  
- Estado de actas (recibidas, procesadas, pendientes)  

### 📊 KPIs (Indicadores)
- Tasa de participación  
- Porcentaje por candidato  
- Margen de victoria  
- Velocidad de procesamiento  
- Diferencias entre RRV y Oficial  

### 🌎 Análisis Geográfico
- Resultados por departamento, municipio y recinto  
- Mapas de calor  
- Distribución territorial del voto  

### ⚖️ Comparación de Sistemas
- Comparación RRV vs Oficial  
- Detección de inconsistencias  
- Alertas visuales  

### 🔍 Transparencia
- % de actas publicadas  
- Acceso a actas digitalizadas  
- Trazabilidad del procesamiento  

---

## 🧠 Arquitectura
- Frontend desacoplado del backend  
- Consumo de APIs (RRV y Cómputo Oficial)  
- CQRS (lecturas optimizadas para dashboards)  
- Actualización en tiempo real

---

## 📡 Flujo de Datos
1. Sistemas RRV y Oficial generan datos  
2. APIs exponen resultados  
3. Dashboard consume datos  
4. Se procesan métricas y KPIs  
5. Se renderizan visualizaciones en tiempo real  

---

## ⚡ Características
- Actualización en tiempo real  
- Alta interactividad  
- Escalabilidad para alto tráfico  
- Visualización clara y accesible  
