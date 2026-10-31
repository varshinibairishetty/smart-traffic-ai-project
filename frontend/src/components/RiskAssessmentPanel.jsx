// src/components/RiskAssessmentPanel.jsx
//
// Explainable Accident Risk Assessment Panel for Hyderabad Corridors.
// Evaluates accident risk using observable speed degradation, live Open-Meteo weather,
// and verified provider incident records. Adheres to scientific transparency standards.

import React from 'react'

export default function RiskAssessmentPanel({
  location = null,
  isTomTomConfigured = false
}) {
  const trafficMetrics = location?.traffic?.metrics || null
  const weather = location?.weather?.conditions || {}
  const incidents = location?.nearby_incidents || []

  // Derive explainable composite score
  const cong = trafficMetrics?.congestion_pct || 0
  const speedPenalty = Math.min(50, Math.round(cong * 0.5))
  
  let weatherPenalty = 0
  if (weather.precipitation_mm > 0) weatherPenalty += 15
  if (weather.visibility_meters && weather.visibility_meters < 3000) weatherPenalty += 10

  const accidents = incidents.filter(i => (i.incident_type || '').includes('ACCIDENT')).length
  const closures = incidents.filter(i => (i.incident_type || '').includes('CLOSURE') || (i.description || '').toLowerCase().includes('closed')).length
  const incidentPenalty = Math.min(30, accidents * 15 + closures * 5 + Math.min(10, Math.round(incidents.length * 0.2)))

  const baseRisk = 10
  const compositeScore = Math.min(100, Math.max(10, baseRisk + speedPenalty + weatherPenalty + incidentPenalty))

  let riskTier = 'Low Risk'
  let riskColor = '#4ade80'
  let riskBg = 'rgba(34, 197, 94, 0.15)'
  let advisory = 'Normal operational flow. Maintain standard green-split cycle.'

  if (compositeScore >= 70) {
    riskTier = 'High Risk'
    riskColor = '#f43f5e'
    riskBg = 'rgba(244, 63, 94, 0.15)'
    advisory = 'High risk detected. Recommend dispatching field patrol and extending queue-clearance signal cycle.'
  } else if (compositeScore >= 40) {
    riskTier = 'Moderate Risk'
    riskColor = '#fbbf24'
    riskBg = 'rgba(251, 191, 36, 0.15)'
    advisory = 'Moderate risk accumulation. Monitor arterial merging points and adjust signal timing if queues form.'
  }

  return (
    <section className="card risk-assessment-section" aria-label="Accident Risk Assessment">
      {/* Header */}
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
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 88, 12, 0.35))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Corridor Risk Assessment
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: riskBg,
                  color: riskColor,
                  border: `1px solid ${riskColor}44`,
                  fontWeight: 600
                }}
              >
                {riskTier} ({compositeScore}/100)
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>
              Explainable heuristic index combining speed degradation, weather conditions & incidents
            </p>
          </div>
        </div>

        <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--mono)' }}>
          Provisional Heuristic ($R_t$)
        </span>
      </div>

      {/* Risk Metrics Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
      >
        <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(71, 85, 105, 0.25)' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Speed Degradation</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            {trafficMetrics ? `${speedPenalty} pts` : '15 pts (Est)'}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>
            {trafficMetrics ? `${trafficMetrics.congestion_pct}% congestion` : 'Awaiting TomTom API'}
          </div>
        </div>

        <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(71, 85, 105, 0.25)' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Weather Penalty</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            +{weatherPenalty} pts
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>
            {weather.precipitation_mm > 0 ? `Rain (${weather.precipitation_mm}mm)` : 'Clear / Dry road'}
          </div>
        </div>

        <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(71, 85, 105, 0.25)' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Nearby Incidents</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            +{incidentPenalty} pts
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>
            {incidents.length} provider reports
          </div>
        </div>
      </div>

      {/* Advisory Banner */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderLeft: `4px solid ${riskColor}`,
          borderTop: '1px solid rgba(71, 85, 105, 0.25)',
          borderRight: '1px solid rgba(71, 85, 105, 0.25)',
          borderBottom: '1px solid rgba(71, 85, 105, 0.25)'
        }}
      >
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
          MUNICIPAL CONTROL ROOM ADVISORY
        </div>
        <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '0.2rem', lineHeight: 1.4 }}>
          {advisory}
        </div>
      </div>
    </section>
  )
}
