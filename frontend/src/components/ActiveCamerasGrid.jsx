// src/components/ActiveCamerasGrid.jsx
//
// 100% Dynamic Active Cameras Grid Component
// Renders camera feed cards dynamically scanned from codebase `videos/` folder.
// Smoothly handles dynamic counts without showing broken warning banners.

import React from 'react'

export default function ActiveCamerasGrid({
  cameras = [],
  focusedCamId = null,
  onSelectCamera = () => {},
  isProcessing = false
}) {
  return (
    <section className="card active-cameras-section" aria-label="Active Cameras from Local Video Ingestion">
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
              background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.25), rgba(6, 182, 212, 0.35))',
              border: '1px solid rgba(20, 184, 166, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            📹
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                Active Cameras
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: cameras.length > 0 ? 'rgba(20, 184, 166, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: cameras.length > 0 ? '#2dd4bf' : '#fbbf24',
                  border: cameras.length > 0 ? '1px solid rgba(20, 184, 166, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                  fontWeight: 600
                }}
              >
                {cameras.length} / {cameras.length} Feeds Online
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '0.15rem 0 0' }}>
              Dynamically mapped from codebase <code>videos/</code> folder • Local-First Ingestion
            </p>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          Auto-Scanned from <code>videos/</code>
        </span>
      </div>

      {/* Grid of Active Camera Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}
      >
        {cameras.map((cam) => {
          const isFocused = focusedCamId === cam.id || (!focusedCamId && cam.number === 1)
          const riskColor = cam.risk?.color || (cam.risk?.score >= 67 ? '#f43f5e' : cam.risk?.score >= 35 ? '#f59e0b' : '#10b981')

          return (
            <div
              key={cam.id}
              onClick={() => onSelectCamera(cam)}
              style={{
                padding: '1rem 1.15rem',
                borderRadius: '12px',
                background: isFocused
                  ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)'
                  : 'rgba(15, 23, 42, 0.55)',
                border: isFocused
                  ? '1.5px solid rgba(56, 189, 248, 0.6)'
                  : '1px solid var(--border)',
                boxShadow: isFocused
                  ? '0 0 20px rgba(56, 189, 248, 0.25), inset 0 0 12px rgba(56, 189, 248, 0.08)'
                  : '0 4px 12px rgba(0, 0, 0, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.22s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Highlight ribbon for focused card */}
              {isFocused && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #38bdf8, #818cf8)'
                  }}
                />
              )}

              {/* Card Header: Camera ID, Name, Live badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        fontFamily: 'var(--mono)'
                      }}
                    >
                      {cam.id}
                    </span>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                      {cam.shortName || cam.name}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-3)', margin: '0.2rem 0 0' }}>
                    📍 {cam.location}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <span style={{ fontSize: '0.5rem', color: '#10b981' }}>●</span> LIVE
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    {cam.filesize_mb} MB
                  </span>
                </div>
              </div>

              {/* File Origin Tag */}
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '0.75rem',
                  fontFamily: 'var(--mono)'
                }}
              >
                <span>📁</span>
                <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  videos/{cam.filename}
                </span>
              </div>

              {/* Real Metrics: Vehicle Count & Rt Risk */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  marginBottom: '0.65rem'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', display: 'block' }}>
                    YOLOv8 Vehicles (Vt)
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-1)' }}>
                    {cam.vehicle_count}
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-3)', marginLeft: '0.25rem' }}>
                      veh
                    </span>
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', display: 'block' }}>
                    Deterministic Risk (Rt)
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      background: `${riskColor}22`,
                      color: riskColor,
                      border: `1px solid ${riskColor}55`,
                      display: 'inline-block'
                    }}
                  >
                    Rt: {cam.risk?.score} ({cam.risk?.category || 'Normal'})
                  </span>
                </div>
              </div>

              {/* Fleet Breakdown Mini-Chips */}
              {cam.breakdown && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    flexWrap: 'wrap',
                    fontSize: '0.7rem',
                    color: 'var(--text-2)',
                    marginBottom: '0.75rem'
                  }}
                >
                  <span style={{ padding: '0.15rem 0.4rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    🚗 {cam.breakdown.car || 0}
                  </span>
                  <span style={{ padding: '0.15rem 0.4rem', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '4px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                    🏍️ {cam.breakdown.motorcycle || 0}
                  </span>
                  <span style={{ padding: '0.15rem 0.4rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '4px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                    🚌 {cam.breakdown.bus || 0}
                  </span>
                  <span style={{ padding: '0.15rem 0.4rem', background: 'rgba(129, 140, 248, 0.1)', borderRadius: '4px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
                    🚛 {cam.breakdown.truck || 0}
                  </span>
                </div>
              )}

              {/* Focus Button */}
              <button
                type="button"
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '0.45rem',
                  borderRadius: '7px',
                  border: isFocused ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid var(--border)',
                  background: isFocused
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.3))'
                    : 'rgba(255, 255, 255, 0.04)',
                  color: isFocused ? '#38bdf8' : 'var(--text-2)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.18s ease'
                }}
              >
                {isFocused ? '✓ Active Feed Inspected' : '⚡ Focus & Inspect Telemetry'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
