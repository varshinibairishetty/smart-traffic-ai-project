// src/components/Header.jsx
//
// The sticky top bar that stays visible as you scroll.
// Shows: project logo | title | backend status indicator | live clock

import { useState, useEffect } from 'react'

export default function Header({ isLive = false, backendError = null }) {
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
      {/* Left side — logo and project name */}
      <div className="header__left">
        <span className="header__logo" aria-hidden="true">🚦</span>
        <div>
          <div className="header__title">Smart Traffic AI</div>
          <div className="header__subtitle">Management &amp; Risk Prediction System</div>
        </div>
      </div>

      {/* Right side — status indicators and clock */}
      <div className="header__right">
        {isLive ? (
          <div className="header__badge header__badge--live">
            <span className="header__dot header__dot--green" />
            Backend Connected
          </div>
        ) : (
          <div className="header__badge header__badge--demo" title={backendError || 'Backend offline'}>
            <span className="header__dot header__dot--amber" />
            Fallback (Sample Data)
          </div>
        )}

        <div className="header__badge header__badge--phase">
          Phase 7 · Integrated
        </div>

        <time className="header__clock" dateTime={time.toISOString()} title="Current local time">
          {formattedTime}
        </time>
      </div>
    </header>
  )
}
