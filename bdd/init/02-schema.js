// 02-schema.js — Crea todas las colecciones de rrv_db con validadores JSON Schema
// Se ejecuta sobre el Primary del Replica Set.

const db = db.getSiblingDB("rrv_db");

// ─────────────────────────────────────────────────────────────────────────────
// Utilidad: crea la colección sólo si no existe ya
// ─────────────────────────────────────────────────────────────────────────────
function createIfNotExists(name, options) {
  const exists = db.getCollectionNames().includes(name);
  if (exists) {
    print("  [skip] " + name + " ya existe");
    return;
  }
  db.createCollection(name, options);
  print("  [ok]   " + name);
}

print("Creando colecciones en rrv_db...");

// ─────────────────────────────────────────────────────────────────────────────
// 1. distribucion_territorial
//    Datos de referencia: departamentos, municipios y provincias de Bolivia.
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("distribucion_territorial", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["codigo", "departamento", "municipio", "provincia"],
      properties: {
        codigo:       { bsonType: "string", description: "Ej: 10101" },
        departamento: { bsonType: "string" },
        municipio:    { bsonType: "string" },
        provincia:    { bsonType: "string" }
      }
    }
  },
  validationAction: "error"
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. candidatos
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("candidatos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id", "nombre", "partido"],
      properties: {
        id:      { bsonType: "int" },
        nombre:  { bsonType: "string" },
        partido: { bsonType: "string" },
        color:   { bsonType: "string", description: "Color hex para el dashboard" }
      }
    }
  },
  validationAction: "error"
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. recintos
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("recintos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["codigo_recinto", "nombre", "codigo_distribucion_territorial"],
      properties: {
        codigo_recinto:                 { bsonType: "int" },
        codigo_distribucion_territorial:{ bsonType: "string" },
        nombre:                         { bsonType: "string" },
        direccion:                      { bsonType: "string" }
      }
    }
  },
  validationAction: "error"
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. mesas
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("mesas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["codigo_mesa", "nro_mesa", "cantidad_habilitada", "codigo_recinto"],
      properties: {
        codigo_mesa:         { bsonType: "int" },
        nro_mesa:            { bsonType: "int" },
        cantidad_habilitada: { bsonType: "int", minimum: 1 },
        codigo_recinto:      { bsonType: "int" }
      }
    }
  },
  validationAction: "error"
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. actas  (colección principal RRV)
//    validationAction: "warn" para no bloquear el flujo en tiempo real.
//    Los campos opcionales (hora_apertura, etc.) pueden llegar vacíos en SMS.
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("actas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_acta", "codigo_mesa", "tipo_entrada", "estado", "timestamp_recepcion"],
      properties: {
        id_acta: {
          bsonType: "string",
          description: "SHA-256 del contenido del acta — llave de idempotencia"
        },
        codigo_mesa:  { bsonType: "int" },
        codigo_recinto: { bsonType: "int" },
        codigo_distribucion_territorial: { bsonType: "string" },
        tipo_entrada: {
          enum: ["FOTO", "SMS"],
          description: "Canal de origen del acta"
        },
        estado: {
          enum: ["RECIBIDA", "OCR_PROCESANDO", "OCR_COMPLETADO", "VALIDADA", "RECHAZADA", "DUPLICADA"],
          description: "Estado en el pipeline"
        },
        votos: {
          bsonType: "object",
          properties: {
            candidatos: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["candidato_id", "votos"],
                properties: {
                  candidato_id: { bsonType: "int" },
                  votos:        { bsonType: "int", minimum: 0 }
                }
              }
            },
            validos: { bsonType: "int", minimum: 0 },
            blancos: { bsonType: "int", minimum: 0 },
            nulos:   { bsonType: "int", minimum: 0 }
          }
        },
        ciudadanos_habilitados: { bsonType: "int", minimum: 0 },
        total_papeletas_anfora: { bsonType: "int", minimum: 0 },
        hora_apertura:          { bsonType: ["date", "null"] },
        hora_cierre:            { bsonType: ["date", "null"] },
        archivo_imagen_path:    { bsonType: "string" },
        hash_imagen:            { bsonType: "string" },
        timestamp_recepcion:    { bsonType: "date" },
        timestamp_procesado:    { bsonType: ["date", "null"] },
        inconsistencias:        { bsonType: "array" },
        fuente:                 { enum: ["FOTO", "SMS"] }
      }
    }
  },
  validationAction: "warn"
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. eventos  (Event Store — append-only, nunca se modifica)
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("eventos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_evento", "tipo", "id_acta", "payload", "timestamp", "version"],
      properties: {
        id_evento: { bsonType: "string" },
        tipo: {
          enum: [
            "ActaRecibida",
            "ActaOCRIniciada",
            "ActaOCRCompletada",
            "ActaValidada",
            "ActaRechazada",
            "ActaDuplicadaIgnorada",
            "ActaSMSRecibida"
          ]
        },
        id_acta:     { bsonType: "string" },
        codigo_mesa: { bsonType: "int" },
        payload:     { bsonType: "object" },
        timestamp:   { bsonType: "date" },
        version:     { bsonType: "int", minimum: 1 }
      }
    }
  },
  validationAction: "error"
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. logs_inconsistencias
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("logs_inconsistencias", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_acta", "tipo", "descripcion", "timestamp"],
      properties: {
        id_acta:     { bsonType: "string" },
        codigo_mesa: { bsonType: "int" },
        tipo: {
          enum: [
            "INCONSISTENCIA_ARITMETICA",
            "DATOS_CONTRADICTORIOS",
            "FALTA_APERTURA_CIERRE",
            "DUPLICADO",
            "SMS_FIRMA_INVALIDA",
            "ESTRUCTURA_INVALIDA"
          ]
        },
        descripcion:       { bsonType: "string" },
        valores_recibidos: { bsonType: "object" },
        timestamp:         { bsonType: "date" },
        resuelto:          { bsonType: "bool" }
      }
    }
  },
  validationAction: "error"
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. vista_resultados  (CQRS — read model actualizado por el proyector)
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("vista_resultados", {});

// ─────────────────────────────────────────────────────────────────────────────
// 9. vista_actas_estado  (CQRS — read model: avance del conteo)
// ─────────────────────────────────────────────────────────────────────────────
createIfNotExists("vista_actas_estado", {});

// ─────────────────────────────────────────────────────────────────────────────
// ÍNDICES
// ─────────────────────────────────────────────────────────────────────────────
print("\nCreando índices...");

// actas: llave de idempotencia + queries frecuentes
db.actas.createIndex({ id_acta: 1 }, { unique: true, name: "idx_acta_id_unico" });
db.actas.createIndex({ codigo_mesa: 1 }, { name: "idx_acta_mesa" });
db.actas.createIndex({ estado: 1 }, { name: "idx_acta_estado" });
db.actas.createIndex({ codigo_distribucion_territorial: 1 }, { name: "idx_acta_territorial" });
db.actas.createIndex({ timestamp_recepcion: -1 }, { name: "idx_acta_recepcion_desc" });
print("  [ok] índices en actas");

// eventos: query por acta y por tipo
db.eventos.createIndex({ id_acta: 1 }, { name: "idx_evento_acta" });
db.eventos.createIndex({ tipo: 1, timestamp: -1 }, { name: "idx_evento_tipo_ts" });
db.eventos.createIndex({ timestamp: -1 }, { name: "idx_evento_ts_desc" });
print("  [ok] índices en eventos");

// recintos y mesas
db.recintos.createIndex({ codigo_recinto: 1 }, { unique: true, name: "idx_recinto_codigo" });
db.mesas.createIndex({ codigo_mesa: 1 }, { unique: true, name: "idx_mesa_codigo" });
db.mesas.createIndex({ codigo_recinto: 1 }, { name: "idx_mesa_recinto" });
print("  [ok] índices en recintos y mesas");

// distribucion_territorial
db.distribucion_territorial.createIndex({ codigo: 1 }, { unique: true, name: "idx_territorial_codigo" });
db.distribucion_territorial.createIndex({ departamento: 1 }, { name: "idx_territorial_depto" });
print("  [ok] índices en distribucion_territorial");

// logs_inconsistencias
db.logs_inconsistencias.createIndex({ id_acta: 1 }, { name: "idx_log_acta" });
db.logs_inconsistencias.createIndex({ tipo: 1, timestamp: -1 }, { name: "idx_log_tipo" });
print("  [ok] índices en logs_inconsistencias");

print("\nEsquema completado.");
