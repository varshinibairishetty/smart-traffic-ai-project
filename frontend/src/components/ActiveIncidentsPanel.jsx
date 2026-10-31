// src/components/ActiveIncidentsPanel.jsx
//
// Active Incidents Panel Component — Displays bottlenecks and traffic anomalies
// dynamically derived from high vehicle density counts (Vt >= 15) or elevated
// risk scores (Rt >= 67) across the scanned local video feeds.

import React from 'react'

export default function ActiveIncidentsPanel({
  incidents = [],
  onUpdateStatus = null
}) {
  const activeList = incidents.filter(i => (i.status || 'Active').toLowerCase() === 'active')

  return (
    <section className="card active-incidents-section" aria-label="Active Traffic Incidents">
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
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                Active Incidents
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: activeList.length > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: activeList.length > 0 ? '#fb7185' : '#34d399',
                  border: activeList.length > 0 ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                  fontWeight: 600
                }}
              >
                {activeList.length} Active {activeList.length === 1 ? 'Anomaly' : 'Anomalies'}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '0.15rem 0 0' }}>
              Derived from high vehicle counts (Vt ≥ 15) & queue congestion in video feeds
            </p>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          Municipal Control Room
        </span>
      </div>

      {/* Incident List */}
      {activeList.length === 0 ? (
        <div
          style={{
            padding: '1.75rem 1rem',
            textAlign: 'center',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border)'
          }}
        >
          <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: '0.35rem' }}>✅</span>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)' }}>
            All Video Corridors Operating Clear
          </p>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-3)', margin: '0.25rem 0 0' }}>
            No critical bottlenecks or queue saturations detected in current video frames.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {activeList.map((inc) => {
            const isHigh = (inc.severity || '').toLowerCase() === 'high' || (inc.severity || '').toLowerCase() === 'critical'
            const badgeBg = isHigh ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'
            const badgeColor = isHigh ? '#f43f5e' : '#f59e0b'
            const badgeBorder = isHigh ? 'rgba(244, 63, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)'

            return (
              <div
                key={inc.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: isHigh ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid var(--border)',
                  boxShadow: isHigh ? '0 0 15px rgba(244, 63, 94, 0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: '220px' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'var(--mono)',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px'
                        }}
                      >
                        {inc.id}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-1)' }}>
                        {inc.type || 'Traffic Flow Anomaly'}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '999px',
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          fontWeight: 700
                        }}
                      >
                        {inc.severity || 'Medium'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', margin: '0.25rem 0 0' }}>
                      📍 <strong>{inc.camera_name || inc.location}</strong>&nbsp;•&nbsp;
                      <span style={{ color: 'var(--text-3)' }}>
                        Trigger: {inc.vehicle_count} veh | Rt={inc.risk_score || 'N/A'}
                      </span>
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: '0.15rem 0 0' }}>
                      {inc.description || 'Elevated density exceeding capacity thresholds.'}
                    </p>
                  </div>
                </div>

                {/* Right side: Action button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {onUpdateStatus && (
                    <button
                      onClick={() => onUpdateStatus(inc.id, 'Dispatched')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      🚓 Dispatch
                    </button>
                  )}
                  {onUpdateStatus && (
                    <button
                      onClick={() => onUpdateStatus(inc.id, 'Resolved')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Resolve
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
