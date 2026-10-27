// src/components/Header.jsx
//
// Dashboard sub-header — shows backend connection status and live clock.
// Sits below the NavBar on the main dashboard page only.
// Not sticky (NavBar handles the sticky top position).

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
      {/* Left side — dashboard page title */}
      <div className="header__left">
        <span className="header__logo" aria-hidden="true">📊</span>
        <div>
          <div className="header__title">Traffic Dashboard</div>
          <div className="header__subtitle">Live Detection · Risk Assessment</div>
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
          Phase 8 · Multi-Page
        </div>

        <time className="header__clock" dateTime={time.toISOString()} title="Current local time">
          {formattedTime}
        </time>
      </div>
    </header>
  )
}
