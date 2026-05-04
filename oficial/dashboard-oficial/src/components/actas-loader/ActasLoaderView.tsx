import { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { apiClient } from '../../api/client';
import { ActaForm } from './ActaForm';
import { ConfigPanel } from './ConfigPanel';
import { PanelInformes } from './PanelInformes';
import type {
  ActaRaw,
  ActiveForm,
  EstadoForm,
  FormsCount,
} from './types';

const CSV_URL = '/transcripciones.csv';

const GRID_CLASS: Record<FormsCount, string> = {
  1: 'max-w-2xl mx-auto',
  4: 'max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3',
  9: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
  16: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2',
};

const TIME_REMOVE_OK_MS = 1000;
const TIME_REMOVE_ERROR_MS = 3000;

function genId(): string {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toIntOrZero(v: string | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function rowToActa(row: Record<string, string>): ActaRaw | null {
  const codigo_acta = toIntOrZero(row.codigo_acta);
  const codigo_mesa = toIntOrZero(row.codigo_mesa);
  if (codigo_acta === 0 || codigo_mesa === 0) return null;
  if (String(codigo_acta).endsWith('0000000')) return null;
  return {
    codigo_acta,
    codigo_mesa,
    votos_p1: toIntOrZero(row.votos_p1),
    votos_p2: toIntOrZero(row.votos_p2),
    votos_p3: toIntOrZero(row.votos_p3),
    votos_p4: toIntOrZero(row.votos_p4),
    blancos: toIntOrZero(row.blancos),
    nulos: toIntOrZero(row.nulos),
    habilitados: toIntOrZero(row.habilitados),
    anfora: toIntOrZero(row.anfora),
    no_usadas: toIntOrZero(row.no_usadas),
    observacion_formal: row.observacion_formal?.trim() || null,
    tipo_observacion_formal: row.tipo_observacion_formal?.trim() || null,
  };
}

function extractMensajeError(response: { status: number; data?: unknown }): string {
  const data = response.data as { detail?: unknown } | undefined;
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null && 'msg' in first) {
      return String((first as { msg: unknown }).msg);
    }
  }
  return `HTTP ${response.status}`;
}

interface Stats {
  ok: number;
  error: number;
}

type SubTab = 'forms' | 'informes';

const SUB_TABS: ReadonlyArray<{ id: SubTab; label: string }> = [
  { id: 'forms', label: 'Forms en vivo' },
  { id: 'informes', label: 'Informes' },
];

export function ActasLoaderView(): JSX.Element {
  const [actas, setActas] = useState<ActaRaw[]>([]);
  const [csvCargando, setCsvCargando] = useState<boolean>(true);
  const [csvError, setCsvError] = useState<string | null>(null);

  const [cursor, setCursor] = useState<number>(0);
  const [forms, setForms] = useState<ActiveForm[]>([]);
  const [formsSimultaneos, setFormsSimultaneos] = useState<FormsCount>(9);
  const [autoSubmit, setAutoSubmit] = useState<boolean>(true);
  const [delayMs, setDelayMs] = useState<number>(2000);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({ ok: 0, error: 0 });
  const [truncating, setTruncating] = useState<boolean>(false);
  const [subTab, setSubTab] = useState<SubTab>('forms');

  // Refs:
  // - formsRef: lectura sincrónica del estado actual desde async callbacks.
  //   Bug fix del race condition que ocurría leyendo acta dentro del
  //   updater funcional de setForms (no garantizado de correr sync).
  // - timersRef: timers de auto-submit y de remoción, indexados por id.
  // - scheduledAutoSubmitRef: set de ids cuyo auto-submit ya fue agendado.
  //   Evita doble agendamiento si el effect re-corre (StrictMode dev o
  //   re-renders por otros cambios de state).
  // - submittingIdsRef: set de ids cuya transición a 'enviando' ya
  //   disparó el POST. Idempotencia anti-doble-POST.
  const formsRef = useRef<ActiveForm[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const scheduledAutoSubmitRef = useRef<Set<string>>(new Set());
  const submittingIdsRef = useRef<Set<string>>(new Set());
  const delayMsRef = useRef<number>(delayMs);
  const isRunningRef = useRef<boolean>(isRunning);

  useEffect(() => { formsRef.current = forms; }, [forms]);
  useEffect(() => { delayMsRef.current = delayMs; }, [delayMs]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // ─── Cargar CSV al mount ────────────────────────────────────────
  useEffect(() => {
    Papa.parse<Record<string, string>>(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      worker: false,
      complete: (results) => {
        const parseadas: ActaRaw[] = [];
        for (const row of results.data) {
          const acta = rowToActa(row);
          if (acta) parseadas.push(acta);
        }
        console.debug(`[ActasLoader] CSV parseado: ${parseadas.length} actas`);
        setActas(parseadas);
        setCsvCargando(false);
      },
      error: (err) => {
        setCsvError(err.message);
        setCsvCargando(false);
      },
    });
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  // ─── Helpers que dispatch state ─────────────────────────────────
  const setEstadoForm = useCallback(
    (id: string, estado: EstadoForm, mensaje?: string) => {
      console.debug(`[Form ${id}] estado=${estado}${mensaje ? ' · ' + mensaje : ''}`);
      setForms((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, estado, mensaje: mensaje ?? f.mensaje } : f,
        ),
      );
    },
    [],
  );

  const removeForm = useCallback((id: string) => {
    console.debug(`[Form ${id}] removed`);
    setForms((prev) => prev.filter((f) => f.id !== id));
    const t = timersRef.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timersRef.current.delete(id);
    }
    scheduledAutoSubmitRef.current.delete(id);
    submittingIdsRef.current.delete(id);
  }, []);

  // ─── submitForm: lectura sincrónica del acta vía formsRef ───────
  const submitForm = useCallback(
    async (id: string) => {
      // Anti-doble-POST: si ya está en flight, no re-enviar.
      if (submittingIdsRef.current.has(id)) {
        console.debug(`[Form ${id}] submit ignorado (ya en flight)`);
        return;
      }
      const target = formsRef.current.find((f) => f.id === id);
      if (!target) {
        console.debug(`[Form ${id}] submit ignorado (form no existe)`);
        return;
      }
      // Solo dispara desde estados elegibles.
      if (
        target.estado !== 'llenando' &&
        target.estado !== 'esperando_submit'
      ) {
        console.debug(
          `[Form ${id}] submit ignorado (estado=${target.estado})`,
        );
        return;
      }
      submittingIdsRef.current.add(id);
      // Cancelar timer de auto-submit pendiente, si existe.
      const tPending = timersRef.current.get(id);
      if (tPending !== undefined) {
        window.clearTimeout(tPending);
        timersRef.current.delete(id);
      }

      setEstadoForm(id, 'enviando');

      try {
        const response = await apiClient.post(
          '/api/v1/oficial/recuento',
          target.acta,
          { validateStatus: () => true },
        );
        if (response.status === 201 || response.status === 200) {
          setEstadoForm(id, 'ok');
          setStats((s) => ({ ...s, ok: s.ok + 1 }));
          const t = window.setTimeout(() => removeForm(id), TIME_REMOVE_OK_MS);
          timersRef.current.set(id, t);
        } else {
          const mensaje = extractMensajeError(response);
          setEstadoForm(id, 'error', mensaje);
          setStats((s) => ({ ...s, error: s.error + 1 }));
          const t = window.setTimeout(
            () => removeForm(id),
            TIME_REMOVE_ERROR_MS,
          );
          timersRef.current.set(id, t);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setEstadoForm(id, 'error', msg);
        setStats((s) => ({ ...s, error: s.error + 1 }));
        const t = window.setTimeout(
          () => removeForm(id),
          TIME_REMOVE_ERROR_MS,
        );
        timersRef.current.set(id, t);
      }
    },
    [removeForm, setEstadoForm],
  );

  const submitFormRef = useRef(submitForm);
  useEffect(() => { submitFormRef.current = submitForm; }, [submitForm]);

  // ─── Feeder: cuando hay slots libres y hay actas, agregar ───────
  useEffect(() => {
    if (!isRunning) return;
    if (forms.length >= formsSimultaneos) return;
    if (cursor >= actas.length) {
      setIsRunning(false);
      return;
    }
    const slotsLibres = formsSimultaneos - forms.length;
    const nuevos: ActiveForm[] = [];
    let nuevoCursor = cursor;
    for (let i = 0; i < slotsLibres && nuevoCursor < actas.length; i += 1) {
      const acta = actas[nuevoCursor];
      const id = genId();
      nuevos.push({ id, acta, estado: 'llenando', cursorIdx: nuevoCursor });
      console.debug(
        `[Form ${id}] estado=llenando · acta=${acta.codigo_acta}`,
      );
      nuevoCursor += 1;
    }
    if (nuevos.length === 0) return;
    setForms((prev) => [...prev, ...nuevos]);
    setCursor(nuevoCursor);
  }, [isRunning, forms.length, formsSimultaneos, cursor, actas]);

  // ─── Scheduler de auto-submit: para cada form 'llenando' que aún
  // no tiene timer, agendar uno. Idempotente vía scheduledAutoSubmitRef.
  // Si autoSubmit cambia a OFF mientras hay timers en vuelo, los timers
  // siguen corriendo pero submitForm respeta el modo via estado actual.
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    forms.forEach((f) => {
      if (f.estado !== 'llenando') return;
      if (scheduledAutoSubmitRef.current.has(f.id)) return;
      // Si autoSubmit=false, marcar el form como 'esperando_submit'
      // para que muestre el botón manual y no agendar timer.
      if (!autoSubmit) {
        scheduledAutoSubmitRef.current.add(f.id);
        // Pequeña delay para que la animación de "transcribiendo" sea
        // visible un instante antes de pasar a "esperando submit".
        const t = window.setTimeout(() => {
          setEstadoForm(f.id, 'esperando_submit');
          timersRef.current.delete(f.id);
        }, 600);
        timersRef.current.set(f.id, t);
        return;
      }
      // autoSubmit=true: agendar el submit con el delay actual.
      scheduledAutoSubmitRef.current.add(f.id);
      const t = window.setTimeout(() => {
        timersRef.current.delete(f.id);
        submitFormRef.current(f.id);
      }, delayMsRef.current);
      timersRef.current.set(f.id, t);
    });
  }, [forms, autoSubmit, setEstadoForm]);

  const handleSubmitManual = useCallback(
    (id: string) => {
      submitForm(id);
    },
    [submitForm],
  );

  const handleStart = useCallback(() => setIsRunning(true), []);
  const handlePause = useCallback(() => setIsRunning(false), []);

  const handleReset = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.clear();
    scheduledAutoSubmitRef.current.clear();
    submittingIdsRef.current.clear();
    setForms([]);
    setCursor(0);
    setStats({ ok: 0, error: 0 });
  }, []);

  const handleTruncarBD = useCallback(async () => {
    const ok = window.confirm(
      'Esto borrará TODAS las actas del backend (acta_oficial, log_inconsistencias, actas_descartadas).\n\n¿Continuar?',
    );
    if (!ok) return;
    setTruncating(true);
    try {
      await apiClient.post(
        '/api/v1/oficial/admin/reset-actas?confirm=YES_DELETE_ALL',
        null,
        { validateStatus: () => true },
      );
      handleReset();
    } finally {
      setTruncating(false);
    }
  }, [handleReset]);

  const procesadas = stats.ok + stats.error;
  const pendientes = forms.length;
  const totalActas = actas.length;
  const compact = formsSimultaneos === 16;

  return (
    <section
      aria-labelledby="actas-loader-titulo"
      className="space-y-4"
    >
      <header>
        <h2
          id="actas-loader-titulo"
          className="text-lg font-semibold mb-1"
        >
          Carga de Actas
        </h2>
        <p className="text-sm text-oficial-text-secondary">
          Forms simultáneos que leen el CSV de transcripciones y postean al
          API oficial. Cada form simula la transcripción humana de un acta
          con animación visible.
        </p>
      </header>

      {/* Sub-tabs */}
      <div
        role="tablist"
        aria-label="Vistas del cargador de actas"
        className="flex border-b border-oficial-border"
      >
        {SUB_TABS.map((t) => {
          const activo = t.id === subTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activo}
              tabIndex={activo ? 0 : -1}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                activo
                  ? 'border-oficial-blue text-oficial-blue font-semibold'
                  : 'border-transparent text-oficial-text-secondary hover:text-oficial-text font-medium'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'forms' && (
        <div className="space-y-4">
          {csvError && (
            <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-800">
              Error cargando CSV: {csvError}
            </div>
          )}

          <ConfigPanel
            formsSimultaneos={formsSimultaneos}
            autoSubmit={autoSubmit}
            delayMs={delayMs}
            isRunning={isRunning}
            csvCargando={csvCargando}
            totalActas={totalActas}
            procesadas={procesadas}
            ok={stats.ok}
            error={stats.error}
            pendientes={pendientes}
            onChangeForms={(n) => setFormsSimultaneos(n)}
            onChangeAutoSubmit={(v) => setAutoSubmit(v)}
            onChangeDelay={(ms) => setDelayMs(ms)}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            onTruncarBD={handleTruncarBD}
            truncating={truncating}
          />

          <div className={GRID_CLASS[formsSimultaneos]}>
            {forms.map((f) => (
              <ActaForm
                key={f.id}
                form={f}
                delayMs={delayMs}
                autoSubmit={autoSubmit}
                compact={compact}
                onSubmitManual={handleSubmitManual}
              />
            ))}
            {forms.length === 0 && !csvCargando && (
              <div
                className={
                  formsSimultaneos === 1
                    ? 'bg-oficial-card border border-dashed border-oficial-border rounded-lg p-8 text-center text-sm text-oficial-text-secondary'
                    : 'col-span-full bg-oficial-card border border-dashed border-oficial-border rounded-lg p-8 text-center text-sm text-oficial-text-secondary'
                }
              >
                {totalActas === 0
                  ? 'No hay actas en el CSV.'
                  : isRunning
                    ? 'Cargando próximo lote…'
                    : `${totalActas.toLocaleString('es-BO')} actas listas. Click en ▶ Iniciar para arrancar.`}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'informes' && <PanelInformes />}
    </section>
  );
}
