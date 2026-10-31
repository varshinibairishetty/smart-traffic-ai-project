// src/components/HyderabadLocationsGrid.jsx
//
// Neo-Glass Grid of Configured Hyderabad Junctions and Corridors.
// Displays live traffic speeds, Open-Meteo meteorological conditions,
// provider-reported incidents, and provisional accident risk estimates.

import React from 'react'

export default function HyderabadLocationsGrid({
  locations = [],
  selectedLocationId = null,
  onSelectLocation = () => {},
  isTomTomConfigured = false
}) {
  return (
    <section className="active-cameras-section" aria-label="Monitored Hyderabad Junctions">
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
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.35))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}
          >
            🏙️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Monitored Hyderabad Corridors
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  fontWeight: 600
                }}
              >
                {locations.length} Locations Active
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>
              Multi-modal telemetry combining live TomTom traffic flow, Open-Meteo weather, and verified incident records
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          <span>Click any corridor card to inspect junction telemetry</span>
        </div>
      </div>

      {/* Grid of Location Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {locations.map((loc) => {
          const locId = loc.location_id || loc.id
          const isSelected = locId === selectedLocationId
          const traffic = loc.traffic || {}
          const trafficMetrics = traffic.metrics || null
          const weather = loc.weather?.conditions || {}
          const weatherFreshness = loc.weather?.data_freshness || 'unavailable'
          const incidentsCount = loc.nearby_incidents_count || 0

          // Calculate provisional risk tier
          const cong = trafficMetrics?.congestion_pct || 0
          const speedPenalty = Math.min(50, Math.round(cong * 0.5))
          const weatherPenalty = (weather.precipitation_mm > 0 ? 15 : 0) + (weather.visibility_meters && weather.visibility_meters < 3000 ? 10 : 0)
          const nearbyList = loc.nearby_incidents || []
          const accidents = nearbyList.filter(i => (i.incident_type || '').includes('ACCIDENT')).length
          const closures = nearbyList.filter(i => (i.incident_type || '').includes('CLOSURE') || (i.description || '').toLowerCase().includes('closed')).length
          const incidentPenalty = Math.min(30, accidents * 15 + closures * 5 + Math.min(10, Math.round(nearbyList.length * 0.2)))

          const riskScore = Math.min(100, Math.max(10, 10 + speedPenalty + weatherPenalty + incidentPenalty))

          let riskTier = 'Low Risk'
          let riskBadgeColor = '#4ade80'
          let riskBg = 'rgba(34, 197, 94, 0.15)'

          if (riskScore >= 70) {
            riskTier = 'High Risk'
            riskBadgeColor = '#f43f5e'
            riskBg = 'rgba(244, 63, 94, 0.15)'
          } else if (riskScore >= 40) {
            riskTier = 'Moderate Risk'
            riskBadgeColor = '#fbbf24'
            riskBg = 'rgba(251, 191, 36, 0.15)'
          }

          return (
            <article
              key={locId}
              onClick={() => onSelectLocation(locId)}
              style={{
                background: isSelected
                  ? 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))'
                  : 'rgba(15, 23, 42, 0.75)',
                border: isSelected
                  ? '2px solid rgba(56, 189, 248, 0.8)'
                  : '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '14px',
                padding: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                position: 'relative',
                boxShadow: isSelected
                  ? '0 0 25px rgba(56, 189, 248, 0.25), inset 0 0 15px rgba(56, 189, 248, 0.1)'
                  : '0 4px 15px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(12px)'
              }}
            >
              {/* Header: Name, Corridor & Selection Indicator */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>
                      {loc.category?.includes('Overpass') || loc.category?.includes('Flyover') ? '🌉' : '🚦'}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      {loc.name}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {loc.corridor}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: riskBg,
                    color: riskBadgeColor,
                    border: `1px solid ${riskBadgeColor}44`,
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {riskTier}
                </span>
              </div>

              {/* Middle Section: 2 Columns (Live Traffic Flow + Live Weather) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderRadius: '10px',
                  border: '1px solid rgba(71, 85, 105, 0.25)'
                }}
              >
                {/* Column 1: Live Traffic Flow */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    <span>🚗</span>
                    <span>Traffic Flow</span>
                  </div>

                  {trafficMetrics ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                          {trafficMetrics.current_speed_kmh}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>km/h</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                        Free Flow: <span style={{ color: '#38bdf8' }}>{trafficMetrics.free_flow_speed_kmh} km/h</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: trafficMetrics.delay_seconds > 60 ? '#f43f5e' : '#4ade80', marginTop: '0.15rem' }}>
                        {trafficMetrics.delay_seconds > 0 ? `+${trafficMetrics.delay_seconds}s delay` : 'No delay recorded'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>
                        {isTomTomConfigured ? 'Scanning Flow...' : 'Key Required'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Limit: {loc.speed_limit_kmh} km/h
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        TomTom API key pending
                      </span>
                    </div>
                  )}
                </div>

                {/* Column 2: Live Weather */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderLeft: '1px solid rgba(71, 85, 105, 0.3)', paddingLeft: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    <span>{weather.icon || '⛅'}</span>
                    <span>Weather</span>
                  </div>

                  {weather.temperature_c != null ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                          {weather.temperature_c}°
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>C</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {weather.condition_text || 'Clear'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        Wind: {weather.wind_speed_kmh || 0} km/h • Hum: {weather.relative_humidity_pct || 0}%
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Open-Meteo
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Fetching Hyderabad observation...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Footer: Coordinates, Incidents & Freshness */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  paddingTop: '0.2rem',
                  borderTop: '1px solid rgba(71, 85, 105, 0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🚨</span>
                  <span style={{ color: incidentsCount > 0 ? '#fb7185' : '#4ade80', fontWeight: 600 }}>
                    {incidentsCount} Provider {incidentsCount === 1 ? 'Incident' : 'Incidents'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--mono)', fontSize: '0.68rem' }}>
                  <span>{loc.coordinates?.latitude?.toFixed(4)}°N</span>
                  <span>{loc.coordinates?.longitude?.toFixed(4)}°E</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
