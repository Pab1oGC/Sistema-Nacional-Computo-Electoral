// 03-seed.js — Carga datos de referencia en rrv_db
// Fuente: Práctica 4 + distribución territorial real de Bolivia

const db = db.getSiblingDB("rrv_db");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Distribución Territorial (9 departamentos de Bolivia)
// ─────────────────────────────────────────────────────────────────────────────
print("Insertando distribucion_territorial...");

const territorial = [
  // Chuquisaca (1)
  { codigo: "10101", departamento: "Chuquisaca", municipio: "Oropeza",  provincia: "Sucre"    },
  { codigo: "10102", departamento: "Chuquisaca", municipio: "Oropeza",  provincia: "Yotala"   },
  { codigo: "10103", departamento: "Chuquisaca", municipio: "Oropeza",  provincia: "Poroma"   },
  { codigo: "10201", departamento: "Chuquisaca", municipio: "Azurduy",  provincia: "Azurduy"  },
  { codigo: "10202", departamento: "Chuquisaca", municipio: "Azurduy",  provincia: "Tarvita"  },
  { codigo: "10301", departamento: "Chuquisaca", municipio: "Zudáñez",  provincia: "Zudáñez"  },

  // La Paz (2)
  { codigo: "20101", departamento: "La Paz", municipio: "Murillo",    provincia: "La Paz"         },
  { codigo: "20102", departamento: "La Paz", municipio: "Murillo",    provincia: "El Alto"         },
  { codigo: "20201", departamento: "La Paz", municipio: "Omasuyos",   provincia: "Achacachi"       },
  { codigo: "20301", departamento: "La Paz", municipio: "Pacajes",    provincia: "Corocoro"        },
  { codigo: "20401", departamento: "La Paz", municipio: "Camacho",    provincia: "Puerto Acosta"   },
  { codigo: "20501", departamento: "La Paz", municipio: "Ingavi",     provincia: "Viacha"          },

  // Cochabamba (3)
  { codigo: "30101", departamento: "Cochabamba", municipio: "Cercado",     provincia: "Cochabamba"  },
  { codigo: "30201", departamento: "Cochabamba", municipio: "Chapare",     provincia: "Sacaba"      },
  { codigo: "30202", departamento: "Cochabamba", municipio: "Chapare",     provincia: "Colomi"      },
  { codigo: "30301", departamento: "Cochabamba", municipio: "Quillacollo", provincia: "Quillacollo" },
  { codigo: "30401", departamento: "Cochabamba", municipio: "Punata",      provincia: "Punata"      },

  // Oruro (4)
  { codigo: "40101", departamento: "Oruro", municipio: "Cercado",    provincia: "Oruro"     },
  { codigo: "40201", departamento: "Oruro", municipio: "Sajama",     provincia: "Turco"     },
  { codigo: "40301", departamento: "Oruro", municipio: "Carangas",   provincia: "Corque"    },

  // Potosí (5)
  { codigo: "50101", departamento: "Potosí", municipio: "Tomás Frías", provincia: "Potosí"  },
  { codigo: "50201", departamento: "Potosí", municipio: "Chayanta",   provincia: "Llallagua"},
  { codigo: "50301", departamento: "Potosí", municipio: "Sud Chichas", provincia: "Tupiza"  },

  // Tarija (6)
  { codigo: "60101", departamento: "Tarija", municipio: "Cercado",    provincia: "Tarija"   },
  { codigo: "60201", departamento: "Tarija", municipio: "Gran Chaco", provincia: "Yacuiba"  },
  { codigo: "60301", departamento: "Tarija", municipio: "O'Connor",   provincia: "Entre Ríos"},

  // Santa Cruz (7)
  { codigo: "70101", departamento: "Santa Cruz", municipio: "Andrés Ibáñez", provincia: "Santa Cruz de la Sierra" },
  { codigo: "70102", departamento: "Santa Cruz", municipio: "Andrés Ibáñez", provincia: "La Guardia"              },
  { codigo: "70201", departamento: "Santa Cruz", municipio: "Warnes",         provincia: "Warnes"                  },
  { codigo: "70301", departamento: "Santa Cruz", municipio: "Chiquitos",      provincia: "San José"                },
  { codigo: "70401", departamento: "Santa Cruz", municipio: "Sara",           provincia: "Portachuelo"             },

  // Beni (8)
  { codigo: "80101", departamento: "Beni", municipio: "Cercado",    provincia: "Trinidad"  },
  { codigo: "80201", departamento: "Beni", municipio: "Mamoré",     provincia: "San Ignacio"},
  { codigo: "80301", departamento: "Beni", municipio: "Iténez",     provincia: "Magdalena" },

  // Pando (9)
  { codigo: "90101", departamento: "Pando", municipio: "Nicolás Suárez", provincia: "Cobija"  },
  { codigo: "90201", departamento: "Pando", municipio: "Manuripi",       provincia: "Puerto Rico" }
];

for (const t of territorial) {
  db.distribucion_territorial.updateOne(
    { codigo: t.codigo },
    { $setOnInsert: t },
    { upsert: true }
  );
}
print("  " + territorial.length + " registros territoriales cargados");

// ─────────────────────────────────────────────────────────────────────────────
// 2. Candidatos (nombres ficticios para la práctica — acta de ejemplo pág. 8)
// ─────────────────────────────────────────────────────────────────────────────
print("Insertando candidatos...");

const candidatos = [
  { id: 1, nombre: "Daenerys Targaryen", partido: "MAS-ISP",     sigla: "MAS",  color: "#003087" },
  { id: 2, nombre: "Sansa Stark",        partido: "Comunidad Ciudadana", sigla: "CC", color: "#E63946" },
  { id: 3, nombre: "Robert Baratheon",   partido: "Creemos",      sigla: "CREE", color: "#F4A261" },
  { id: 4, nombre: "Tyrion Lannister",   partido: "APB-Súmate",   sigla: "APB",  color: "#2A9D8F" }
];

for (const c of candidatos) {
  db.candidatos.updateOne(
    { id: c.id },
    { $setOnInsert: c },
    { upsert: true }
  );
}
print("  " + candidatos.length + " candidatos cargados");

// ─────────────────────────────────────────────────────────────────────────────
// 3. Recintos electorales (muestra de los datos de la práctica)
// ─────────────────────────────────────────────────────────────────────────────
print("Insertando recintos...");

const recintos = [
  { codigo_recinto: 1, codigo_distribucion_territorial: "10101",
    nombre: "U.E. Santa Mónica",
    direccion: "Calle Achanq'ara entre las calles Chariña y Qoyllur, OTB Ticti Norte" },
  { codigo_recinto: 2, codigo_distribucion_territorial: "10102",
    nombre: "U.E. Padresama",
    direccion: "Carretera Cochabamba-Santa Cruz km 150, sindicato agrario Padresama" },
  { codigo_recinto: 3, codigo_distribucion_territorial: "10103",
    nombre: "U.E. Lacolaconi",
    direccion: "Lacolaconi" },
  { codigo_recinto: 4, codigo_distribucion_territorial: "10201",
    nombre: "U.E. Genoveva Ríos",
    direccion: "Calle Los Robles entre Av. Segunda Circunvalación y Calle Sófocles" },
  { codigo_recinto: 5, codigo_distribucion_territorial: "10202",
    nombre: "U.E. 27 de Mayo",
    direccion: "René Barrientos Ortuño" },
  { codigo_recinto: 6, codigo_distribucion_territorial: "20101",
    nombre: "Colegio Ayacucho",
    direccion: "Av. Ayacucho, La Paz" },
  { codigo_recinto: 7, codigo_distribucion_territorial: "20101",
    nombre: "Liceo Venezuela",
    direccion: "Av. Venezuela, La Paz" },
  { codigo_recinto: 8, codigo_distribucion_territorial: "30101",
    nombre: "Colegio Alemán",
    direccion: "Av. Alemana, Cochabamba" },
  { codigo_recinto: 9, codigo_distribucion_territorial: "70101",
    nombre: "U.E. San Martín",
    direccion: "Av. San Martín, Santa Cruz" },
  { codigo_recinto: 10, codigo_distribucion_territorial: "20102",
    nombre: "Don Bosco",
    direccion: "Av. Bolivia, El Alto" }
];

for (const r of recintos) {
  db.recintos.updateOne(
    { codigo_recinto: r.codigo_recinto },
    { $setOnInsert: r },
    { upsert: true }
  );
}
print("  " + recintos.length + " recintos cargados");

// ─────────────────────────────────────────────────────────────────────────────
// 4. Mesas electorales
// ─────────────────────────────────────────────────────────────────────────────
print("Insertando mesas...");

const mesas = [
  { codigo_mesa: 35000, nro_mesa: 1,  cantidad_habilitada: 589, codigo_recinto: 1 },
  { codigo_mesa: 34999, nro_mesa: 2,  cantidad_habilitada: 538, codigo_recinto: 2 },
  { codigo_mesa: 34998, nro_mesa: 3,  cantidad_habilitada: 259, codigo_recinto: 3 },
  { codigo_mesa: 34997, nro_mesa: 4,  cantidad_habilitada: 524, codigo_recinto: 4 },
  { codigo_mesa: 34996, nro_mesa: 5,  cantidad_habilitada: 992, codigo_recinto: 5 },
  { codigo_mesa: 34995, nro_mesa: 6,  cantidad_habilitada: 808, codigo_recinto: 6 },
  { codigo_mesa: 34994, nro_mesa: 7,  cantidad_habilitada: 430, codigo_recinto: 6 },
  { codigo_mesa: 34993, nro_mesa: 8,  cantidad_habilitada: 612, codigo_recinto: 7 },
  { codigo_mesa: 34992, nro_mesa: 9,  cantidad_habilitada: 715, codigo_recinto: 8 },
  { codigo_mesa: 34991, nro_mesa: 10, cantidad_habilitada: 340, codigo_recinto: 9 }
];

for (const m of mesas) {
  db.mesas.updateOne(
    { codigo_mesa: m.codigo_mesa },
    { $setOnInsert: m },
    { upsert: true }
  );
}
print("  " + mesas.length + " mesas cargadas");

// ─────────────────────────────────────────────────────────────────────────────
// 5. Inicializar vista_resultados (CQRS read model en cero)
// ─────────────────────────────────────────────────────────────────────────────
print("Inicializando vista_resultados...");

const iniciarCandidatos = candidatos.map(c => ({
  candidato_id:       c.id,
  nombre:             c.nombre,
  partido:            c.partido,
  sigla:              c.sigla,
  color:              c.color,
  votos_total:        0,
  porcentaje:         0.0,
  por_departamento:   {},
  ultima_actualizacion: new Date()
}));

for (const r of iniciarCandidatos) {
  db.vista_resultados.updateOne(
    { candidato_id: r.candidato_id },
    { $setOnInsert: r },
    { upsert: true }
  );
}
print("  vista_resultados inicializada");

// ─────────────────────────────────────────────────────────────────────────────
// 6. Inicializar vista_actas_estado (CQRS read model en cero)
// ─────────────────────────────────────────────────────────────────────────────
print("Inicializando vista_actas_estado...");

db.vista_actas_estado.updateOne(
  { _id: "global" },
  {
    $setOnInsert: {
      _id: "global",
      total_mesas:      35000,
      actas_recibidas:  0,
      actas_validadas:  0,
      actas_procesando: 0,
      actas_rechazadas: 0,
      actas_pendientes: 35000,
      porcentaje_avance: 0.0,
      por_departamento: {
        "Chuquisaca": { recibidas: 0, validadas: 0, rechazadas: 0 },
        "La Paz":      { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Cochabamba":  { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Oruro":       { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Potosí":      { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Tarija":      { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Santa Cruz":  { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Beni":        { recibidas: 0, validadas: 0, rechazadas: 0 },
        "Pando":       { recibidas: 0, validadas: 0, rechazadas: 0 }
      },
      ultima_actualizacion: new Date()
    }
  },
  { upsert: true }
);
print("  vista_actas_estado inicializada");

print("\nDatos semilla cargados correctamente.");
