import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { DEPARTMENTS, PARTIES, Party } from '../data/mockData';

interface Props {
  parties:     Party[];
  activeDepts: Set<string>;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  deptId: string;
}

export function BoliviaMap({ parties, activeDepts }: Props) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, deptId: '' });

  const partyMap = Object.fromEntries(parties.map(p => [p.id, p]));

  useEffect(() => {
    if (!svgRef.current) return;
    gsap.from(svgRef.current.querySelectorAll('.dept-path'), {
      opacity: 0,
      scale: 0.92,
      transformOrigin: 'center center',
      stagger: { amount: 0.6, from: 'center' },
      duration: 0.7,
      ease: 'power2.out',
      delay: 0.5,
    });
  }, []);

  function handleMouseEnter(e: React.MouseEvent<SVGPathElement>, deptId: string) {
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      deptId,
    });
  }

  function handleMouseMove(e: React.MouseEvent<SVGPathElement>) {
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  }

  const tooltipDept  = DEPARTMENTS.find(d => d.id === tooltip.deptId);
  const tooltipParty = tooltipDept ? partyMap[tooltipDept.leadingPartyId] : null;

  return (
    <div
      className="glass panel map-panel"
      role="region"
      aria-label="Mapa de Bolivia por departamento"
      style={{ flex: 1 }}
    >
      <h2 className="panel-title">Mapa departamental</h2>
      <div className="map-svg-wrapper">
        <svg
          ref={svgRef}
          viewBox="0 0 485 565"
          className="map-svg"
          style={{ overflow: 'visible' }}
          aria-hidden="true"
        >
          <defs>
            {DEPARTMENTS.map(d => {
              const party = partyMap[d.leadingPartyId];
              if (!party) return null;
              return (
                <radialGradient key={d.id} id={`grad-${d.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={party.color} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={party.color} stopOpacity="0.25" />
                </radialGradient>
              );
            })}
          </defs>

          {/* Department paths */}
          {DEPARTMENTS.map(d => {
            const party    = partyMap[d.leadingPartyId];
            const isActive = activeDepts.has(d.id);
            const reportPct = d.mesasReporting / d.mesasTotal;
            if (!party) return null;

            return (
              <g key={d.id}>
                <path
                  d={d.path}
                  className={`dept-path${isActive ? ' dept-active' : ''}`}
                  fill={`url(#grad-${d.id})`}
                  style={{
                    stroke: party.color,
                    strokeOpacity: 0.4 + reportPct * 0.3,
                    opacity:       0.65 + reportPct * 0.25,
                  }}
                  onMouseEnter={e => handleMouseEnter(e, d.id)}
                  onMouseMove ={handleMouseMove}
                  onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                  tabIndex={0}
                  aria-label={`${d.name}: liderando ${party.name} con ${d.leadingPct}%, ${Math.round(reportPct * 100)}% de mesas reportadas`}
                  role="img"
                />
                {/* Department label */}
                <text
                  x={d.labelX}
                  y={d.labelY - 6}
                  className="dept-label"
                >
                  {d.name === 'Chuquisaca' ? 'Chuis.' : d.name}
                </text>
                <text
                  x={d.labelX}
                  y={d.labelY + 6}
                  className="dept-label-pct"
                >
                  {Math.round(reportPct * 100)}%
                </text>

                {/* Active pulse ring */}
                {isActive && (
                  <circle
                    cx={d.labelX}
                    cy={d.labelY}
                    r="18"
                    fill="none"
                    stroke={party.color}
                    strokeWidth="1.5"
                    opacity="0.6"
                    style={{ animation: 'deptPulse 0.8s ease-out' }}
                  />
                )}
              </g>
            );
          })}

          {/* Outer Bolivia boundary (stylized) */}
          <path
            d="M 10,5 L 475,5 L 475,545 L 322,558 L 168,554 L 10,522 Z"
            fill="none"
            stroke="rgba(244,196,48,0.12)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Tooltip */}
        {tooltip.visible && tooltipDept && tooltipParty && (
          <div
            className="map-tooltip"
            role="tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="tooltip-dept" style={{ color: tooltipParty.color }}>
              {tooltipDept.name}
            </div>
            <div className="tooltip-row">
              <span>Partido líder</span>
              <span className="tooltip-val">{tooltipParty.name}</span>
            </div>
            <div className="tooltip-row">
              <span>Participación</span>
              <span className="tooltip-val" style={{ color: tooltipParty.color }}>
                {tooltipDept.leadingPct.toFixed(1)}%
              </span>
            </div>
            <div className="tooltip-row">
              <span>Mesas</span>
              <span className="tooltip-val">
                {tooltipDept.mesasReporting} / {tooltipDept.mesasTotal}
              </span>
            </div>
            <div className="tooltip-row">
              <span>Reportado</span>
              <span className="tooltip-val" style={{ color: '#22D3EE' }}>
                {Math.round((tooltipDept.mesasReporting / tooltipDept.mesasTotal) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Party legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
        paddingTop: 8, borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {parties.slice(0, 6).map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
