import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  totalVotos:      number;
  mesasReportando: number;
  mesasTotales:    number;
  actasTotal:      number;
  habilitados:     number;
}

function useCounter(value: number, duration = 1.2) {
  const spanRef  = useRef<HTMLSpanElement>(null);
  const prevRef  = useRef(value);

  useEffect(() => {
    const obj = { v: prevRef.current };
    gsap.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate() {
        if (spanRef.current) {
          spanRef.current.textContent = Math.floor(obj.v).toLocaleString('es-BO');
        }
      },
    });
    prevRef.current = value;
  }, [value, duration]);

  return spanRef;
}

interface CardProps {
  label:       string;
  value:       number;
  sub:         string;
  color:       string;
  glow:        string;
  barPct?:     number;
}

function StatCard({ label, value, sub, color, glow, barPct }: CardProps) {
  const ref = useCounter(value);

  return (
    <div
      className="glass stat-card"
      style={{ '--accent-color': color, '--accent-glow': glow } as React.CSSProperties}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        <span ref={ref}>{value.toLocaleString('es-BO')}</span>
      </div>
      <div className="stat-sub">{sub}</div>
      {barPct !== undefined && (
        <div className="stat-bar-track">
          <div className="stat-bar-fill" style={{ width: `${barPct}%` }} />
        </div>
      )}
    </div>
  );
}

export function StatsRow({ totalVotos, mesasReportando, mesasTotales, actasTotal, habilitados }: Props) {
  const mesasPct      = Math.round((mesasReportando / mesasTotales)   * 100);
  const participacion = ((totalVotos / habilitados) * 100);

  return (
    <div className="stats-row" role="region" aria-label="Estadísticas generales">
      <StatCard
        label  ="Votos computados"
        value  ={totalVotos}
        sub    ={`${participacion.toFixed(1)}% de participación`}
        color  ="#F4C430"
        glow   ="rgba(244,196,48,0.4)"
        barPct ={participacion}
      />
      <StatCard
        label  ="Mesas reportando"
        value  ={mesasReportando}
        sub    ={`de ${mesasTotales.toLocaleString('es-BO')} · ${mesasPct}%`}
        color  ="#22D3EE"
        glow   ="rgba(34,211,238,0.4)"
        barPct ={mesasPct}
      />
      <StatCard
        label  ="Actas procesadas"
        value  ={actasTotal}
        sub    ="Total actas recibidas"
        color  ="#10B981"
        glow   ="rgba(16,185,129,0.4)"
      />
      <StatCard
        label  ="Habilitados"
        value  ={habilitados}
        sub    ="Votantes registrados"
        color  ="#A78BFA"
        glow   ="rgba(167,139,250,0.4)"
      />
    </div>
  );
}
