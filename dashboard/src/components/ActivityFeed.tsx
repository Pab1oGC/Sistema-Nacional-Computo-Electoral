import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ActivityItem } from '../data/mockData';

interface Props { items: ActivityItem[] }

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ActivityRow({ item, isNew }: { item: ActivityItem; isNew: boolean }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!rowRef.current || mounted.current) return;
    mounted.current = true;
    if (isNew) {
      gsap.from(rowRef.current, {
        x: 30, opacity: 0, duration: 0.4, ease: 'power3.out',
      });
    }
  }, [isNew]);

  const estadoClass = {
    VALIDADA:  'estado-validada',
    REVISION:  'estado-revision',
    RECHAZADA: 'estado-rechazada',
  }[item.estado];

  return (
    <div
      ref={rowRef}
      className="activity-item"
      role="listitem"
      aria-label={`Mesa ${item.codigoMesa}, ${item.departamento}, estado: ${item.estado}`}
    >
      {/* Tipo badge */}
      <div
        className={`activity-tipo ${item.tipo === 'FOTO' ? 'tipo-foto' : 'tipo-form'}`}
        aria-label={item.tipo === 'FOTO' ? 'Fotografía' : 'Formulario'}
      >
        {item.tipo}
      </div>

      {/* Body */}
      <div className="activity-body">
        <div className="activity-mesa">
          Mesa {item.codigoMesa}
        </div>
        <div className="activity-dept">{item.departamento}</div>
      </div>

      {/* Right */}
      <div className="activity-right">
        <div className={`estado-badge ${estadoClass}`} aria-label={`Estado: ${item.estado}`}>
          {item.estado === 'VALIDADA' ? 'VALIDADA' : item.estado === 'REVISION' ? 'REVISIÓN' : 'RECHAZADA'}
        </div>
        <div className="activity-time" aria-label={`Hora: ${formatTime(item.timestamp)}`}>
          {formatTime(item.timestamp)}
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({ items }: Props) {
  const listRef  = useRef<HTMLDivElement>(null);
  const prevLen  = useRef(items.length);

  useEffect(() => {
    // Auto-scroll to top when new item arrives
    if (items.length > prevLen.current && listRef.current) {
      listRef.current.scrollTop = 0;
    }
    prevLen.current = items.length;
  }, [items.length]);

  // Track which items are "new" (just appeared at the top)
  const newId = items[0]?.id;

  return (
    <div
      className="glass panel"
      style={{ flex: 1 }}
      role="region"
      aria-label="Actividad reciente de transmisión"
    >
      <h2 className="panel-title">Actividad reciente</h2>

      {/* Counter bar */}
      <div style={{
        display: 'flex', gap: 8, flexShrink: 0,
        padding: '6px 0 10px',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Total',      count: items.length,                                color: 'var(--text-sub)' },
          { label: 'Validadas',  count: items.filter(i => i.estado === 'VALIDADA').length,  color: '#10B981' },
          { label: 'Revisión',   count: items.filter(i => i.estado === 'REVISION').length,  color: '#F59E0B' },
          { label: 'Rechazadas', count: items.filter(i => i.estado === 'RECHAZADA').length, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14, fontWeight: 700,
              color: s.color, lineHeight: 1,
            }}>
              {s.count}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600, letterSpacing: 0.5 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        ref={listRef}
        className="activity-list"
        role="list"
        aria-live="polite"
        aria-label="Lista de actividad electoral reciente"
      >
        {items.map((item, i) => (
          <ActivityRow key={item.id} item={item} isNew={i === 0 && item.id === newId} />
        ))}
      </div>
    </div>
  );
}
