// src/components/Header.jsx
//
// Dashboard Sub-Header — Neo-Glass Command Center HUD
// Shows live operational telemetry status, system phase badge, and high-precision UTC/IST clock.

import { useState, useEffect } from 'react'

export default function Header({
  isLive = false,
  backendError = null,
  subtitle = "Real-Time YOLOv8 Vision · Deterministic Rt Heuristics"
}) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedTime = time.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })

  return (
    <header className="header" role="banner">
      {/* Left side — Command Center Dashboard Title */}
      <div className="header__left">
        <div className="header__logo-wrap">
          <span className="header__logo" aria-hidden="true">🌐</span>
        </div>
        <div>
          <h1 className="header__title">Traffic Command Center</h1>
          <div className="header__subtitle">{subtitle}</div>
        </div>
      </div>

      {/* Right side — Status indicators and live HUD clock */}
      <div className="header__right">
        {isLive ? (
          <div className="header__badge header__badge--live">
            <span className="header__dot header__dot--green" />
            <span>Backend Online</span>
          </div>
        ) : (
          <div className="header__badge header__badge--demo" title={backendError || 'Backend offline'}>
            <span className="header__dot header__dot--amber" />
            <span>Fallback Mode</span>
          </div>
        )}

        <div className="header__badge header__badge--phase">
          <span>⚡ YOLOv8 Vision Engine</span>
        </div>

        <time className="header__clock" dateTime={time.toISOString()} title="Station Local Time">
          <span style={{ color: 'var(--blue)', marginRight: '4px' }}>IST</span> {formattedTime}
        </time>
      </div>
    </header>
  )
}
