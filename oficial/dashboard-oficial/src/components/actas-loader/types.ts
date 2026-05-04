export interface ActaRaw {
  codigo_acta: number;
  codigo_mesa: number;
  votos_p1: number;
  votos_p2: number;
  votos_p3: number;
  votos_p4: number;
  blancos: number;
  nulos: number;
  habilitados: number;
  anfora: number;
  no_usadas: number;
  observacion_formal: string | null;
  tipo_observacion_formal: string | null;
}

export type EstadoForm =
  | 'llenando'
  | 'esperando_submit'
  | 'enviando'
  | 'ok'
  | 'error';

export interface ActiveForm {
  id: string;
  acta: ActaRaw;
  estado: EstadoForm;
  mensaje?: string;
  cursorIdx: number;
}

export type FormsCount = 1 | 4 | 9 | 16;

export const FORMS_COUNTS: ReadonlyArray<FormsCount> = [1, 4, 9, 16];

// Catálogo hardcoded de partidos. Coincide con el seed de
// oficial.partido (sql/04-carga-catalogos-v2.sql) y con la paleta del
// resto del dashboard.
export interface PartidoMeta {
  votosKey: keyof Pick<
    ActaRaw,
    'votos_p1' | 'votos_p2' | 'votos_p3' | 'votos_p4'
  >;
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
}

export const PARTIDOS: ReadonlyArray<PartidoMeta> = [
  {
    votosKey: 'votos_p1',
    sigla_candidato: 'P1',
    nombre_candidato: 'Daenerys Targaryen',
    sigla_partido: 'MAS-ISP',
    color_hex: '#003087',
  },
  {
    votosKey: 'votos_p2',
    sigla_candidato: 'P2',
    nombre_candidato: 'Sansa Stark',
    sigla_partido: 'CC',
    color_hex: '#E63946',
  },
  {
    votosKey: 'votos_p3',
    sigla_candidato: 'P3',
    nombre_candidato: 'Robert Baratheon',
    sigla_partido: 'Creemos',
    color_hex: '#F4A261',
  },
  {
    votosKey: 'votos_p4',
    sigla_candidato: 'P4',
    nombre_candidato: 'Tyrion Lannister',
    sigla_partido: 'APB',
    color_hex: '#2A9D8F',
  },
];
