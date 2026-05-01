#!/bin/bash
# Inicializa el Replica Set rrv-rs, crea el esquema y carga datos semilla.
# Corre DENTRO del contenedor mongo-setup.
set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   RRV - Inicialización del Cluster MongoDB   ║"
echo "╚══════════════════════════════════════════════╝"

# ── 1. Esperar que los 3 nodos estén listos ──────────────────────────────────
echo ""
echo "▶ Verificando disponibilidad de nodos..."
for host in mongo1 mongo2 mongo3; do
  echo -n "  Esperando $host..."
  until mongosh --host "$host" --port 27017 --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q "^1"; do
    echo -n "."
    sleep 2
  done
  echo " OK"
done

# ── 2. Inicializar Replica Set ───────────────────────────────────────────────
echo ""
echo "▶ Inicializando Replica Set 'rrv-rs'..."

mongosh --host mongo1 --port 27017 --quiet --eval '
  try {
    const cfg = {
      _id: "rrv-rs",
      members: [
        { _id: 0, host: "mongo1:27017", priority: 1 },
        { _id: 1, host: "mongo2:27017", priority: 3 },
        { _id: 2, host: "mongo3:27017", priority: 1 }
      ]
    };
    const result = rs.initiate(cfg);
    if (result.ok === 1) {
      print("  Replica Set iniciado correctamente");
    } else {
      print("  Respuesta: " + JSON.stringify(result));
    }
  } catch(e) {
    if (e.codeName === "AlreadyInitialized") {
      print("  Replica Set ya estaba inicializado — continuando");
    } else {
      throw e;
    }
  }
'

# ── 3. Esperar elección de Primary ──────────────────────────────────────────
echo ""
echo "▶ Esperando elección de Primary..."
sleep 5

MAX_WAIT=60
ELAPSED=0
until mongosh --host mongo1 --port 27017 --quiet \
      --eval "rs.hello().isWritablePrimary" 2>/dev/null | grep -q "true"; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "  ERROR: timeout esperando Primary" >&2
    exit 1
  fi
  echo -n "."
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
echo ""
echo "  Primary elegido en mongo1"

# ── 4. Crear colecciones y esquema ──────────────────────────────────────────
echo ""
echo "▶ Creando colecciones y validadores..."
mongosh --host mongo1 --port 27017 --quiet /scripts/02-schema.js

# ── 5. Cargar datos semilla ──────────────────────────────────────────────────
echo ""
echo "▶ Cargando datos semilla (territorial, recintos, mesas, candidatos)..."
mongosh --host mongo1 --port 27017 --quiet /scripts/03-seed.js

# ── 6. Verificación final ────────────────────────────────────────────────────
echo ""
echo "▶ Estado final del Replica Set:"
mongosh --host mongo1 --port 27017 --quiet --eval '
  const members = rs.status().members;
  members.forEach(m => {
    const role = m.stateStr === "PRIMARY" ? "[PRIMARY]" : "[SECONDARY]";
    print("  " + role + " " + m.name);
  });
'

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  ✔  Cluster listo                                               ║"
echo "║                                                                  ║"
echo "║  String de conexión (desde el host):                            ║"
echo "║  mongodb://mongo1:27017,mongo2:27017,mongo3:27017/rrv_db        ║"
echo "║         ?replicaSet=rrv-rs                                       ║"
echo "║                                                                  ║"
echo "║  ⚠  Asegúrate de haber ejecutado agregar-hosts.bat (admin)      ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
