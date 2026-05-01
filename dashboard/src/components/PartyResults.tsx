import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Party } from '../data/mockData';

interface Props { parties: Party[] }

function PartyBar({ party, rank }: { party: Party; rank: number }) {
  const fillRef  = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const prevPct  = useRef(0);
  const prevVotes = useRef(0);
  const mounted  = useRef(false);

  useEffect(() => {
    if (!fillRef.current) return;

    if (!mounted.current) {
      // Initial entrance: animate from 0
      gsap.from(fillRef.current, {
        scaleX: 0,
        duration: 1.1,
        delay: rank * 0.1,
        ease: 'power3.out',
        transformOrigin: 'left center',
      });
      mounted.current = true;
    } else {
      // Live update: smooth width transition
      gsap.to(fillRef.current, {
        scaleX: party.pct / 100,
        duration: 0.8,
        ease: 'power2.out',
        transformOrigin: 'left center',
      });
    }
    prevPct.current = party.pct;
  }, [party.pct]);

  useEffect(() => {
    if (!countRef.current) return;
    const obj = { v: prevVotes.current };
    gsap.to(obj, {
      v: party.votes,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate() {
        if (countRef.current) {
          countRef.current.textContent = Math.floor(obj.v).toLocaleString('es-BO');
        }
      },
    });
    prevVotes.current = party.votes;
  }, [party.votes]);

  const isLeading = rank === 0;

  return (
    <div className={`party-row${isLeading ? ' leading' : ''}`} role="listitem">
      <div className="party-meta">
        <div className="party-name">
          <span
            className="party-dot"
            style={{
              background: party.color,
              boxShadow: isLeading ? `0 0 8px ${party.color}` : 'none',
            }}
            aria-hidden="true"
          />
          {party.name}
          {isLeading && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 1,
              color: party.color, marginLeft: 2,
              background: `${party.color}22`, borderRadius: 4,
              padding: '1px 5px', border: `1px solid ${party.color}44`,
            }}>
              1°
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="party-votes">
            <span ref={countRef}>{party.votes.toLocaleString('es-BO')}</span>
          </div>
          <div className="party-pct" style={{ color: party.color }}>
            {party.pct.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="party-bar-track" role="progressbar" aria-valuenow={party.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${party.name}: ${party.pct.toFixed(1)}%`}>
        <div
          ref={fillRef}
          className="party-bar-fill"
          style={{
            background: `linear-gradient(to right, ${party.color}CC, ${party.color})`,
            width: '100%',
            transform: `scaleX(${party.pct / 100})`,
            boxShadow: isLeading ? `0 0 12px ${party.glow}` : 'none',
          }}
        />
      </div>
    </div>
  );
}

export function PartyResults({ parties }: Props) {
  const sorted = [...parties].sort((a, b) => b.votes - a.votes);

  return (
    <div className="glass panel" style={{ flex: 1.4 }} role="region" aria-label="Resultados por organización política">
      <h2 className="panel-title">Resultados nacionales</h2>
      <div className="party-list" role="list">
        {sorted.map((p, i) => (
          <PartyBar key={p.id} party={p} rank={i} />
        ))}
      </div>
    </div>
  );
}
