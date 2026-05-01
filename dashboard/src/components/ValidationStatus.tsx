import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface Data {
  validadas:  number;
  revision:   number;
  rechazadas: number;
  total:      number;
}

interface Props { data: Data }

const SEGMENTS = [
  { key: 'validadas',  label: 'Validadas',  color: '#10B981', track: '#10B98122' },
  { key: 'revision',   label: 'En revisión', color: '#F59E0B', track: '#F59E0B22' },
  { key: 'rechazadas', label: 'Rechazadas', color: '#EF4444', track: '#EF444422' },
] as const;

function AnimatedCount({ value }: { value: number }) {
  const ref  = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const obj = { v: prev.current };
    gsap.to(obj, {
      v: value, duration: 0.9, ease: 'power2.out',
      onUpdate() {
        if (ref.current) ref.current.textContent = Math.floor(obj.v).toLocaleString('es-BO');
      },
    });
    prev.current = value;
  }, [value]);

  return <span ref={ref}>{value.toLocaleString('es-BO')}</span>;
}

export function ValidationStatus({ data }: Props) {
  const cx = 80, cy = 80, r = 56, sw = 14;
  const circ = 2 * Math.PI * r;

  const vals = [data.validadas, data.revision, data.rechazadas];
  const total = data.total || 1;

  // Calculate stroke-dasharray segments
  let offset = 0;
  const arcs = vals.map((v, i) => {
    const pct  = v / total;
    const len  = circ * pct;
    const gap  = circ - len;
    const dash = { dasharray: `${len} ${gap}`, dashoffset: -(offset * circ / (2 * Math.PI * r)) };
    // dashoffset in terms of circumference units
    const dashOffset = -offset * circ;
    offset += pct;
    return { len, dashOffset, color: SEGMENTS[i].color };
  });

  const dominated = vals.indexOf(Math.max(...vals));
  const domPct    = total > 0 ? (vals[dominated] / total * 100).toFixed(1) : '0.0';

  return (
    <div
      className="glass panel"
      style={{ flex: 1 }}
      role="region"
      aria-label="Estado de actas electorales"
    >
      <h2 className="panel-title">Estado de actas</h2>

      <div className="validation-donut-wrapper">
        {/* Donut */}
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          className="donut-svg"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={sw}
          />

          {/* Segments */}
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={sw}
              strokeDasharray={`${arc.len} ${circ - arc.len}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="round"
              transform="rotate(-90, 80, 80)"
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
            />
          ))}

          {/* Center label */}
          <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle"
            fill="#F1F5F9" fontSize="20" fontWeight="800" fontFamily="JetBrains Mono, monospace">
            {domPct}%
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
            fill="#64748B" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif" letterSpacing="0.5">
            VALIDADAS
          </text>
        </svg>

        {/* Legend */}
        <div className="donut-legend" role="list">
          {SEGMENTS.map((s, i) => {
            const count = vals[i];
            const pct   = total > 0 ? (count / total * 100).toFixed(1) : '0.0';
            return (
              <div key={s.key} className="legend-row" role="listitem">
                <div className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
                <span className="legend-label">{s.label}</span>
                <span className="legend-count" style={{ color: s.color }}>
                  <AnimatedCount value={count} />
                </span>
                <span className="legend-pct">{pct}%</span>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
            <div className="legend-row">
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
              <span className="legend-label" style={{ fontWeight: 600 }}>Total</span>
              <span className="legend-count">
                <AnimatedCount value={data.total} />
              </span>
              <span className="legend-pct" style={{ color: 'var(--text-sub)' }}>100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
