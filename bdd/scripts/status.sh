#!/bin/bash
# Muestra el estado actual del Replica Set rrv-rs.
# Uso: bash scripts/status.sh
# Requiere que el cluster esté levantado con docker compose.

echo ""
echo "════════════════════════════════════════════"
echo "  Estado del Replica Set: rrv-rs"
echo "════════════════════════════════════════════"

docker exec rrv-mongo1 mongosh --quiet --eval '
  const s = rs.status();
  print("Nombre del set: " + s.set);
  print("");
  s.members.forEach(m => {
    const role  = m.stateStr.padEnd(10);
    const lag   = m.optimeDate ? "" : " (no disponible)";
    const health = m.health === 1 ? "✔ UP" : "✘ DOWN";
    print("  " + health + "  [" + role + "]  " + m.name + lag);
  });
  print("");
  print("Votos en el set: " + s.members.filter(m => m.health === 1).length + "/" + s.members.length);
' 2>/dev/null || echo "  ERROR: no se pudo conectar a rrv-mongo1. ¿Está levantado el cluster?"

echo ""
echo "════════════════════════════════════════════"
echo "  Conteo rápido en rrv_db"
echo "════════════════════════════════════════════"

docker exec rrv-mongo1 mongosh --quiet rrv_db --eval '
  print("  actas          : " + db.actas.countDocuments());
  print("  eventos        : " + db.eventos.countDocuments());
  print("  inconsistencias: " + db.logs_inconsistencias.countDocuments());
  print("  mesas          : " + db.mesas.countDocuments());
  print("  recintos       : " + db.recintos.countDocuments());
  print("  candidatos     : " + db.candidatos.countDocuments());
  print("  territorial    : " + db.distribucion_territorial.countDocuments());
' 2>/dev/null

echo ""
