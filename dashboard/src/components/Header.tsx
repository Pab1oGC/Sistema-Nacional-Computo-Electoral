import React, { useEffect, useState } from 'react';

export function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="header" role="banner">
      <div className="header-left">
        <div className="header-seal" aria-hidden="true">
          <div className="header-seal-inner">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              {/* Simplified Bolivia coat of arms */}
              <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              {/* Mountain */}
              <polygon points="11,5 7,14 15,14" fill="#007A33" opacity="0.9" />
              {/* Snow cap */}
              <polygon points="11,5 9.5,8 12.5,8" fill="white" opacity="0.9" />
              {/* Sun */}
              <circle cx="11" cy="4.5" r="2" fill="#F4C430" />
              {/* Rays */}
              {[0,45,90,135,180,225,270,315].map((deg, i) => (
                <line key={i}
                  x1={11 + Math.cos(deg * Math.PI/180) * 3}
                  y1={4.5 + Math.sin(deg * Math.PI/180) * 3}
                  x2={11 + Math.cos(deg * Math.PI/180) * 4.2}
                  y2={4.5 + Math.sin(deg * Math.PI/180) * 4.2}
                  stroke="#F4C430" strokeWidth="0.8" opacity="0.7"
                />
              ))}
            </svg>
          </div>
        </div>
        <div className="header-title-group">
          <span className="header-super">Estado Plurinacional de Bolivia</span>
          <h1 className="header-title">Sistema Nacional de Cómputo Electoral</h1>
        </div>
      </div>

      <div className="header-center">
        <div className="flag-stripe" aria-label="Bandera de Bolivia" />
        <div className="live-badge" role="status" aria-label="Transmisión en vivo">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-text">En vivo</span>
        </div>
      </div>

      <div className="header-right">
        <div style={{ textAlign: 'right' }}>
          <div className="header-clock" aria-live="polite" aria-label={`Hora: ${timeStr}`}>
            {timeStr}
          </div>
          <div className="header-date">{dateStr}</div>
        </div>
      </div>
    </header>
  );
}
