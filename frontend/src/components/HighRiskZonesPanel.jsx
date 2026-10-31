// src/components/HighRiskZonesPanel.jsx
//
// High Risk Zones Panel Component — Highlights video corridors and camera feeds
// with calculated risk scores meeting or exceeding the High Risk threshold (Rt >= 67).
// Provides actionable municipal traffic police control room recommendations.

import React from 'react'

export default function HighRiskZonesPanel({
  highRiskZones = [],
  onSelectCamera = () => {}
}) {
  return (
    <section className="card high-risk-zones-section" aria-label="High Risk Traffic Zones">
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
            🔥
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                High Risk Zones
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: highRiskZones.length > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: highRiskZones.length > 0 ? '#f43f5e' : '#34d399',
                  border: highRiskZones.length > 0 ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                  fontWeight: 600
                }}
              >
                {highRiskZones.length} Feeds at Rt ≥ 67
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '0.15rem 0 0' }}>
              Evaluated via deterministic heuristic model: Rt = min(100, 0.55·Dt + 0.20·Vtrend + 0.15·Mt + 0.10·Pt)
            </p>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          Threshold: Rt ≥ 67
        </span>
      </div>

      {highRiskZones.length === 0 ? (
        <div
          style={{
            padding: '1.75rem 1rem',
            textAlign: 'center',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border)'
          }}
        >
          <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: '0.35rem' }}>🛡️</span>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Zero High-Risk Corridors
          </p>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-3)', margin: '0.25rem 0 0' }}>
            All camera video streams are currently operating within safe municipal density limits (Rt &lt; 67).
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
          {highRiskZones.map((zone) => {
            const isCritical = (zone.severity || '').toLowerCase() === 'critical' || zone.risk_score >= 85
            const accentColor = isCritical ? '#f43f5e' : '#f59e0b'

            return (
              <div
                key={zone.camera_id || zone.zone_id}
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: `1px solid ${accentColor}44`,
                  boxShadow: `0 4px 16px ${accentColor}18`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                {/* Zone Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        fontFamily: 'var(--mono)'
                      }}
                    >
                      {zone.camera_id} • {zone.camera_name}
                    </span>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)', margin: '0.15rem 0 0' }}>
                      {zone.name || 'Corridor Intersection'}
                    </h3>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      background: `${accentColor}22`,
                      color: accentColor,
                      border: `1px solid ${accentColor}55`
                    }}
                  >
                    Rt: {zone.risk_score}
                  </span>
                </div>

                {/* Risk Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
                    <span>Accident Risk Intensity</span>
                    <span style={{ color: accentColor, fontWeight: 700 }}>{zone.severity || 'High Risk'}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, zone.risk_score)}%`,
                        height: '100%',
                        background: isCritical
                          ? 'linear-gradient(90deg, #f59e0b, #f43f5e)'
                          : 'linear-gradient(90deg, #38bdf8, #f59e0b)',
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                </div>

                {/* Tactical Recommendation for Police Control Room */}
                <div
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.72rem',
                    color: '#e2e8f0',
                    lineHeight: 1.4
                  }}
                >
                  <strong style={{ color: accentColor, display: 'block', marginBottom: '0.15rem' }}>
                    ⚡ Control Room Advisory:
                  </strong>
                  {zone.recommendation || 'Extend green-split signal timing and monitor queue formation.'}
                </div>

                {/* Inspect Button */}
                <button
                  type="button"
                  onClick={() => onSelectCamera({ id: zone.camera_id, name: zone.camera_name })}
                  style={{
                    padding: '0.4rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#94a3b8',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Inspect Camera Feed →
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
