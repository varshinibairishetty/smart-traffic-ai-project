// src/components/AlertBanner.jsx
//
// Persistent floating emergency banner that triggers across all routes
// whenever a live Socket.io update reports accident risk score Rt > 70.

import { Link } from 'react-router-dom'
import { useRiskAlert } from '../hooks/useRiskAlert.js'

export default function AlertBanner() {
  const { alert, isMuted, toggleMute, dismissAlert } = useRiskAlert()

  if (!alert) return null

  const isCritical = alert.score >= 85

  return (
    <div
      className="risk-alert-banner"
      role="alert"
      aria-live="assertive"
      style={{
        position: 'sticky',
        top: '60px',
        zIndex: 999,
        background: isCritical
          ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.98))'
          : 'linear-gradient(90deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.98))',
        color: '#ffffff',
        padding: '0.65rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        borderBottom: '2px solid rgba(255, 255, 255, 0.25)',
        animation: 'pulseAlert 2s infinite ease-in-out'
      }}
    >
      {/* Left indicator & text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.4rem', animation: 'spinPulse 1.5s infinite alternate' }}>🚨</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              background: '#ffffff',
              color: isCritical ? '#dc2626' : '#d97706',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {isCritical ? 'CRITICAL RISK ALERT' : 'HIGH RISK ADVISORY'}
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              {alert.node}{alert.sub_zone ? ` • ${alert.sub_zone}` : ''} — Rt: {alert.score}/100
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '2px' }}>
            Queue spillover &amp; spatial conflict potential ({alert.vehicles} vehicles). Signal cycle extension advised.
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Link
          to="/live-map"
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '0.3rem 0.65rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid rgba(255, 255, 255, 0.4)'
          }}
        >
          🗺️ View Map
        </Link>
        <Link
          to="/cameras"
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '0.3rem 0.65rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid rgba(255, 255, 255, 0.4)'
          }}
        >
          📹 Live Cams
        </Link>

        {/* Audio Mute / Unmute Toggle */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Sound muted — click to enable audio alerts' : 'Sound active — click to mute'}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '0.3rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {isMuted ? '🔇 Audio Muted' : '🔊 Chime Active'}
        </button>

        {/* Dismiss Button */}
        <button
          onClick={dismissAlert}
          title="Dismiss advisory"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.2rem 0.5rem',
            opacity: 0.8
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
