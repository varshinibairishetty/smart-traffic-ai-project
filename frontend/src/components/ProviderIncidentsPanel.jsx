// src/components/ProviderIncidentsPanel.jsx
//
// Provider-Reported Traffic Incidents Component.
// Displays verified external incident reports (collisions, roadworks, closures)
// sourced strictly from live traffic provider APIs (TomTom Traffic Incidents).
// Never labels normal congestion or high density as verified accidents.

import React from 'react'

export default function ProviderIncidentsPanel({
  incidents = [],
  isTomTomConfigured = false,
  selectedLocationName = 'All Corridors'
}) {
  return (
    <section className="card active-incidents-section" aria-label="Provider Traffic Incidents">
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(225, 29, 72, 0.35))',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            🚨
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Provider-Reported Incidents
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: incidents.length > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  color: incidents.length > 0 ? '#fb7185' : '#4ade80',
                  border: incidents.length > 0 ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(34, 197, 94, 0.35)',
                  fontWeight: 600
                }}
              >
                {incidents.length} Verified {incidents.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>
              TomTom Traffic Incidents API • Hyderabad Metropolitan Corridor
            </p>
          </div>
        </div>

        <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--mono)' }}>
          Scope: {selectedLocationName}
        </span>
      </div>

      {/* Incident Content */}
      {!isTomTomConfigured ? (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 600, fontSize: '0.85rem' }}>
            <span>ℹ️</span>
            <span>Live Provider API Key Unconfigured</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
            To fetch real-time provider incidents and live speed telemetry for Hyderabad, register for a free non-commercial key at{' '}
            <a
              href="https://developer.tomtom.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#38bdf8', textDecoration: 'underline' }}
            >
              developer.tomtom.com
            </a>{' '}
            and add it to your <code>backend/.env</code> file:
          </p>
          <div
            style={{
              padding: '0.5rem 0.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '6px',
              fontFamily: 'var(--mono)',
              fontSize: '0.75rem',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.2)'
            }}
          >
            TOMTOM_API_KEY=your_tomtom_api_key_here
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
            * Note: Live Open-Meteo weather is active without an API key. Synthetic incidents are never generated.
          </p>
        </div>
      ) : incidents.length === 0 ? (
        <div
          style={{
            padding: '1.75rem 1rem',
            textAlign: 'center',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px dashed rgba(52, 211, 153, 0.3)'
          }}
        >
          <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>✅</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#34d399' }}>
            No Active Incident Reports
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Zero provider-verified collisions, road closures, or hazardous blockages reported in this corridor.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.35rem' }}>
          {incidents.slice(0, 15).map((incident, idx) => {
            const incId = incident.incident_id || incident.id || idx
            const type = incident.incident_type || incident.type || 'TRAFFIC_ALERT'
            const desc = incident.description || 'Verified Roadway Obstruction'
            const delay = incident.delay_seconds || 0
            const route = incident.from_location && incident.to_location
              ? `${incident.from_location} ➔ ${incident.to_location}`
              : incident.from_location || incident.to_location || null
            const startTime = incident.start_time || incident.reported_at

            const isClosure = type === 'ROAD_CLOSURE' || desc.toLowerCase().includes('closed')
            const isAccident = type === 'ACCIDENT'

            return (
              <div
                key={incId}
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: isAccident
                    ? '1px solid rgba(244, 63, 94, 0.5)'
                    : isClosure
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(71, 85, 105, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1rem' }}>
                      {isAccident ? '💥' : isClosure ? '⛔' : '🚧'}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                      {desc}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: isAccident ? 'rgba(244, 63, 94, 0.2)' : isClosure ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      color: isAccident ? '#fb7185' : isClosure ? '#fbbf24' : '#38bdf8',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontWeight: 600
                    }}
                  >
                    {type.replace(/_/g, ' ')}
                  </span>
                </div>

                {route && (
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                    Corridor: <strong>{route}</strong>
                  </div>
                )}

                <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {delay > 0 && <span style={{ color: '#f43f5e', fontWeight: 600 }}>+{delay}s delay</span>}
                  {incident.length_meters > 0 && <span>Span: {Math.round(incident.length_meters)}m</span>}
                  <span>Reported: {startTime ? new Date(startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
                </div>
              </div>
            )
          })}
          {incidents.length > 15 && (
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748b', padding: '0.25rem' }}>
              Showing top 15 of {incidents.length} verified reports within 4 km
            </div>
          )}
        </div>
      )}
    </section>
  )
}
