import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  PARTIES, INITIAL_STATS, INITIAL_ACTIVITY, DEPARTMENTS,
  generateActivityItem, Party, Stats, ActivityItem,
} from './data/mockData';
import { Header }           from './components/Header';
import { StatsRow }         from './components/StatsRow';
import { PartyResults }     from './components/PartyResults';
import { BoliviaMap }       from './components/BoliviaMap';
import { ValidationStatus } from './components/ValidationStatus';
import { ActivityFeed }     from './components/ActivityFeed';

export default function App() {
  const [parties,  setParties]  = useState(PARTIES);
  const [stats,    setStats]    = useState(INITIAL_STATS);
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY);
  const [activeDepts, setActiveDepts] = useState<Set<string>>(new Set());

  const appRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  // ── Entrance animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.header',    { y: -50, opacity: 0, duration: 0.7 })
        .from('.stat-card', { y: 30,  opacity: 0, scale: 0.88, stagger: 0.09, duration: 0.55 }, '-=0.4')
        .from('.panel',     { y: 24,  opacity: 0, stagger: 0.07, duration: 0.55 }, '-=0.35');
    }, appRef);
    return () => ctx.revert();
  }, []);

  // ── Live data simulation ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++;

      setParties(prev => {
        // Distribute 150–700 new votes across parties weighted by current share
        const newTotal = Math.floor(Math.random() * 550) + 150;
        const updated  = prev.map(p => ({
          ...p,
          votes: p.votes + Math.round(newTotal * (p.pct / 100) * (0.7 + Math.random() * 0.6)),
        }));
        const grandTotal = updated.reduce((s, p) => s + p.votes, 0);
        return updated.map(p => ({ ...p, pct: (p.votes / grandTotal) * 100 }));
      });

      setStats(prev => {
        const newVotes   = Math.floor(Math.random() * 550) + 150;
        const newActas   = Math.random() > 0.5 ? Math.floor(Math.random() * 4) : 0;
        const newMesas   = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;
        return {
          ...prev,
          totalVotos:      prev.totalVotos + newVotes,
          actasValidadas:  prev.actasValidadas  + newActas,
          mesasReportando: Math.min(prev.mesasReportando + newMesas, prev.mesasTotales),
        };
      });

      // New activity item every other tick
      if (tickRef.current % 2 === 0) {
        const item = generateActivityItem();
        setActivity(prev => [item, ...prev].slice(0, 30));
      }

      // Pulse a random department
      const depts = DEPARTMENTS;
      const d = depts[Math.floor(Math.random() * depts.length)];
      setActiveDepts(prev => {
        const n = new Set(prev);
        n.add(d.id);
        return n;
      });
      setTimeout(() => {
        setActiveDepts(prev => {
          const n = new Set(prev);
          n.delete(d.id);
          return n;
        });
      }, 3600);
    }, 3200);

    return () => clearInterval(id);
  }, []);

  // Derived validation totals
  const totalActas = stats.actasValidadas + stats.actasRevision + stats.actasRechazadas;
  const validationData = {
    validadas:  stats.actasValidadas,
    revision:   stats.actasRevision,
    rechazadas: stats.actasRechazadas,
    total:      totalActas,
  };

  return (
    <>
      <div className="bg-layer" aria-hidden="true" />
      <div className="bg-grid"  aria-hidden="true" />

      <div className="app" ref={appRef}>
        <Header />

        <StatsRow
          totalVotos      ={stats.totalVotos}
          mesasReportando ={stats.mesasReportando}
          mesasTotales    ={stats.mesasTotales}
          actasTotal      ={totalActas}
          habilitados     ={stats.habilitados}
        />

        <div className="content-grid">
          {/* Left col: party results + validation */}
          <div className="col">
            <PartyResults parties={parties} />
            <ValidationStatus data={validationData} />
          </div>

          {/* Center: map */}
          <div className="col">
            <BoliviaMap parties={parties} activeDepts={activeDepts} />
          </div>

          {/* Right: activity feed */}
          <div className="col">
            <ActivityFeed items={activity} />
          </div>
        </div>
      </div>
    </>
  );
}
