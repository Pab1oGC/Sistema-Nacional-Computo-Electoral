export interface Party {
  id: string;
  name: string;
  color: string;
  glow: string;
  votes: number;
  pct: number;
}

export interface Department {
  id: string;
  name: string;
  leadingPartyId: string;
  leadingPct: number;
  mesasReporting: number;
  mesasTotal: number;
  // SVG path in a 480×560 viewBox
  path: string;
  labelX: number;
  labelY: number;
}

export interface ActivityItem {
  id: string;
  tipo: 'FOTO' | 'FORM';
  codigoMesa: string;
  departamento: string;
  estado: 'VALIDADA' | 'REVISION' | 'RECHAZADA';
  timestamp: Date;
}

export interface Stats {
  totalVotos: number;
  actasValidadas: number;
  actasRevision: number;
  actasRechazadas: number;
  mesasReportando: number;
  mesasTotales: number;
  habilitados: number;
}

// ─── Parties ──────────────────────────────────────────────────────────────────

export const PARTIES: Party[] = [
  { id: 'mas',   name: 'MAS-IPSP',  color: '#2563EB', glow: 'rgba(37,99,235,0.35)',   votes: 1_847_234, pct: 38.2 },
  { id: 'cc',    name: 'CC',         color: '#EA580C', glow: 'rgba(234,88,12,0.35)',   votes: 1_423_891, pct: 29.5 },
  { id: 'apb',   name: 'APB',        color: '#7C3AED', glow: 'rgba(124,58,237,0.35)',  votes:   623_045, pct: 12.9 },
  { id: 'mnr',   name: 'MNR',        color: '#059669', glow: 'rgba(5,150,105,0.35)',   votes:   432_178, pct:  8.9 },
  { id: 'ucs',   name: 'UCS',        color: '#D97706', glow: 'rgba(217,119,6,0.35)',   votes:   287_654, pct:  5.9 },
  { id: 'fpv',   name: 'FPV',        color: '#DB2777', glow: 'rgba(219,39,119,0.35)',  votes:   145_321, pct:  3.0 },
  { id: 'otros', name: 'OTROS',      color: '#475569', glow: 'rgba(71,85,105,0.35)',   votes:    73_445, pct:  1.5 },
];

// ─── Departments ──────────────────────────────────────────────────────────────

export const DEPARTMENTS: Department[] = [
  {
    id: 'lp', name: 'La Paz', leadingPartyId: 'mas', leadingPct: 45.2,
    mesasReporting: 1247, mesasTotal: 1523,
    path: 'M 10,58 L 112,72 L 222,65 L 242,202 L 162,252 L 10,248 Z',
    labelX: 118, labelY: 155,
  },
  {
    id: 'pd', name: 'Pando', leadingPartyId: 'mas', leadingPct: 41.3,
    mesasReporting: 87, mesasTotal: 105,
    path: 'M 10,5 L 215,5 L 222,65 L 112,72 L 10,58 Z',
    labelX: 110, labelY: 36,
  },
  {
    id: 'bn', name: 'Beni', leadingPartyId: 'cc', leadingPct: 38.7,
    mesasReporting: 234, mesasTotal: 312,
    path: 'M 215,5 L 475,5 L 475,262 L 330,262 L 222,65 Z',
    labelX: 355, labelY: 115,
  },
  {
    id: 'or', name: 'Oruro', leadingPartyId: 'mas', leadingPct: 52.1,
    mesasReporting: 387, mesasTotal: 423,
    path: 'M 10,248 L 162,252 L 158,375 L 88,385 L 10,348 Z',
    labelX: 82, labelY: 313,
  },
  {
    id: 'cb', name: 'Cochabamba', leadingPartyId: 'mas', leadingPct: 39.4,
    mesasReporting: 892, mesasTotal: 987,
    path: 'M 162,202 L 242,202 L 330,262 L 330,375 L 158,375 Z',
    labelX: 248, labelY: 295,
  },
  {
    id: 'po', name: 'Potosí', leadingPartyId: 'mas', leadingPct: 58.3,
    mesasReporting: 456, mesasTotal: 523,
    path: 'M 10,348 L 88,385 L 158,375 L 202,488 L 168,528 L 10,522 Z',
    labelX: 98, labelY: 438,
  },
  {
    id: 'ch', name: 'Chuquisaca', leadingPartyId: 'apb', leadingPct: 33.8,
    mesasReporting: 198, mesasTotal: 267,
    path: 'M 158,375 L 330,375 L 372,472 L 312,502 L 202,488 Z',
    labelX: 270, labelY: 438,
  },
  {
    id: 'sc', name: 'Santa Cruz', leadingPartyId: 'cc', leadingPct: 47.8,
    mesasReporting: 1023, mesasTotal: 1456,
    path: 'M 330,262 L 475,262 L 475,542 L 388,552 L 372,472 L 330,375 Z',
    labelX: 408, labelY: 398,
  },
  {
    id: 'ta', name: 'Tarija', leadingPartyId: 'mnr', leadingPct: 29.5,
    mesasReporting: 187, mesasTotal: 245,
    path: 'M 168,528 L 202,488 L 312,502 L 372,472 L 388,552 L 322,558 L 168,554 Z',
    labelX: 278, labelY: 524,
  },
];

// ─── Initial stats ────────────────────────────────────────────────────────────

export const INITIAL_STATS: Stats = {
  totalVotos:      4_832_768,
  actasValidadas:  3_621,
  actasRevision:   156,
  actasRechazadas: 70,
  mesasReportando: 4_711,
  mesasTotales:    6_201,
  habilitados:     7_329_000,
};

// ─── Activity seed ────────────────────────────────────────────────────────────

const DEPTS = ['La Paz', 'Santa Cruz', 'Cochabamba', 'Oruro', 'Beni', 'Potosí', 'Chuquisaca', 'Tarija', 'Pando'];
const ESTADOS: ActivityItem['estado'][] = ['VALIDADA', 'VALIDADA', 'VALIDADA', 'REVISION', 'RECHAZADA'];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateActivityItem(offset = 0): ActivityItem {
  const ts = new Date(Date.now() - offset);
  return {
    id:           ts.getTime().toString() + Math.random(),
    tipo:         Math.random() > 0.5 ? 'FOTO' : 'FORM',
    codigoMesa:   randInt(10000, 99999).toString(),
    departamento: randItem(DEPTS),
    estado:       randItem(ESTADOS),
    timestamp:    ts,
  };
}

export const INITIAL_ACTIVITY: ActivityItem[] = Array.from({ length: 10 }, (_, i) =>
  generateActivityItem(i * 12000)
);

export { randItem, DEPTS };
