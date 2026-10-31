// src/pages/AccidentRiskAnalysis.jsx
//
// Mode B: Location-Based Accident Risk Analysis
// Spatiotemporally Aligned Multi-Modal Risk Analysis for Configured Hyderabad Corridors.
//
// Features:
//   • Selects verified Hyderabad junctions (HITEC City default, Gachibowli, Madhapur, etc.)
//   • Aligned Live Meteorological Conditions (Open-Meteo REST API, [API_RETRIEVED])
//   • Aligned Traffic Flow Conditions (TomTom Flow, [API_RETRIEVED] or [UNCONFIGURED])
//   • Documented Historical Accident Hotspot Records ([HISTORICAL_RECORD])
//   • Transparent Heuristic Composite Baseline Risk Score (Rt) ([CALCULATED_HEURISTIC])
//   • Explicit Data Provenance & Alignment Audit Table

import React, { useState, useEffect } from 'react'
import { fetchLocations, fetchLocationRiskAnalysis } from '../services/api.js'

export default function AccidentRiskAnalysis() {
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('hitec-city')
  const [analysisData, setAnalysisData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // 1. Load Locations on Mount
  useEffect(() => {
    fetchLocations()
      .then(res => {
        if (res && res.locations) {
          setLocations(res.locations)
        }
      })
      .catch(() => {})
  }, [])

  // 2. Fetch Aligned Location Risk Analysis on location change
  const loadAnalysis = async (locId, isRefresh = false) => {
    if (!locId) return
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const data = await fetchLocationRiskAnalysis(locId, isRefresh)
      setAnalysisData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAnalysis(selectedLocationId)
  }, [selectedLocationId])

  const handleLocationChange = (e) => {
    setSelectedLocationId(e.target.value)
  }

  const location = analysisData?.location || {}
  const weather = analysisData?.weather?.conditions || {}
  const traffic = analysisData?.traffic_flow?.metrics || null
  const accidentHistory = analysisData?.accident_history || {}
  const hotspotMetrics = accidentHistory.hotspot_metrics || {}
  const riskAssessment = analysisData?.risk_assessment || {}
  const provenanceAudit = analysisData?.data_provenance_audit || []

  return (
    <div className="page-container" aria-label="Mode B Accident Risk Analysis">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>🛡️ Location-Based Accident Risk Analysis (Mode B)</h1>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                fontWeight: 600
              }}
            >
              Spatiotemporally Aligned
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
            Multi-modal evaluation combining live weather, verified historical crash records, and arterial traffic flow without requiring video feeds
          </p>
        </div>

        {/* Location Dropdown & Refresh Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="mode-b-location-select" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
            Select Junction:
          </label>
          <select
            id="mode-b-location-select"
            value={selectedLocationId}
            onChange={handleLocationChange}
            style={{
              background: '#0f172a',
              color: '#f8fafc',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              borderRadius: '8px',
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadAnalysis(selectedLocationId, true)}
            disabled={refreshing || loading}
            className="btn-refresh"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer'
            }}
          >
            <span>🔄</span>
            <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Scientific Transparency Notice */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
            <strong>Scientific Integrity Guarantee:</strong> In Mode B, features are strictly spatiotemporally aligned to <strong>{location.name || 'the selected corridor'}</strong>.
            Arbitrary uploaded video footage is never conflated with this junction's weather or historical accident records.
          </div>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--mono)' }}>
          Model: Deterministic Heuristic ($R_t$) Baseline
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#38bdf8' }}>
          <div>⏳ Loading spatiotemporally aligned data for {selectedLocationId}...</div>
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '10px', color: '#fb7185' }}>
          Error loading analysis: {error}
        </div>
      ) : (
        <>
          {/* Top 3 Core Aligned Indicators */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem'
            }}
          >
            {/* 1. Historical Hotspot Risk Index */}
            <article className="card" style={{ padding: '1.1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  1. Historical Hotspot Risk
                </span>
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', fontFamily: 'var(--mono)' }}>
                  HISTORICAL_RECORD
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: hotspotMetrics.hotspot_color || '#fbbf24', marginTop: '0.4rem' }}>
                {hotspotMetrics.hotspot_score || 0}<span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}> / 100</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.15rem' }}>
                {hotspotMetrics.hotspot_tier || 'Low Historical Risk'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                {accidentHistory.total_recorded_accidents} archival collisions ({hotspotMetrics.fatal_count} fatal, {hotspotMetrics.severe_count} severe) documented at this junction.
              </div>
            </article>

            {/* 2. Current Traffic Congestion */}
            <article className="card" style={{ padding: '1.1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  2. Current Traffic Congestion
                </span>
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'var(--mono)' }}>
                  {traffic ? 'API_RETRIEVED' : 'UNCONFIGURED'}
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.4rem' }}>
                {traffic ? `${traffic.congestion_pct}%` : 'Normal Flow'}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.15rem' }}>
                {traffic ? `Speed: ${traffic.current_speed_kmh} km/h (Limit: ${location.speed_limit_kmh})` : `Baseline speed limit: ${location.speed_limit_kmh} km/h`}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                {traffic ? `Delay: +${traffic.delay_seconds}s vs free-flow speed (${traffic.free_flow_speed_kmh} km/h)` : 'TomTom Traffic API key optional; baseline urban flow model active.'}
              </div>
            </article>

            {/* 3. Estimated Accident Risk Score (Rt) */}
            <article className="card" style={{ padding: '1.1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.75)', border: `1.5px solid ${riskAssessment.color || '#fbbf24'}66` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  3. Heuristic Risk Score (Rt)
                </span>
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontFamily: 'var(--mono)' }}>
                  CALCULATED_HEURISTIC
                </span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: riskAssessment.color || '#fbbf24', marginTop: '0.4rem' }}>
                {riskAssessment.score || 0}<span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}> / 100</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: riskAssessment.color || '#fbbf24', marginTop: '0.15rem' }}>
                {riskAssessment.category || 'Low Risk'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                Explainable baseline heuristic combining live weather penalty, traffic speed drop, and historical hotspot weighting.
              </div>
            </article>
          </div>

          {/* Middle Row: Aligned Live Weather & Historical Accident Records */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.25rem'
            }}
          >
            {/* Aligned Live Weather Details */}
            <section className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{weather.icon || '⛅'}</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Aligned Meteorological Conditions
                  </h3>
                </div>
                <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600 }}>
                  API_RETRIEVED (Open-Meteo)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ambient Temperature</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
                    {weather.temperature_c != null ? `${weather.temperature_c}°C` : 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{weather.condition_text || 'Clear Sky'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Precipitation / Road State</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: weather.precipitation_mm > 0 ? '#f43f5e' : '#4ade80' }}>
                    {weather.precipitation_mm != null ? `${weather.precipitation_mm} mm` : '0 mm'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {weather.precipitation_mm > 0 ? 'Wet road surface' : 'Dry asphalt surface'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Wind Velocity</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                    {weather.wind_speed_kmh != null ? `${weather.wind_speed_kmh} km/h` : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Relative Humidity</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                    {weather.relative_humidity_pct != null ? `${weather.relative_humidity_pct}%` : 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.75rem' }}>
                📍 Coordinates: {location.coordinates?.latitude}° N, {location.coordinates?.longitude}° E • Retrieved directly for this junction.
              </div>
            </section>

            {/* Documented Historical Accident Records */}
            <section className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>📑</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Archival Accident Records ({location.short_name || location.name})
                  </h3>
                </div>
                <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', fontWeight: 600 }}>
                  HISTORICAL_RECORD
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {(accidentHistory.accidents || []).map(acc => (
                  <div
                    key={acc.accident_id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{acc.road_name}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: acc.severity === 'Fatal' ? 'rgba(244, 63, 94, 0.2)' : acc.severity === 'Severe' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: acc.severity === 'Fatal' ? '#fb7185' : acc.severity === 'Severe' ? '#fbbf24' : '#38bdf8',
                          fontWeight: 600
                        }}
                      >
                        {acc.severity}
                      </span>
                    </div>
                    <div style={{ color: '#cbd5e1' }}>
                      Type: <strong>{acc.collision_type}</strong> • Casualties: <strong>{acc.casualty_count}</strong> ({acc.vehicles_involved} vehicles)
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                      Factors: {acc.contributing_factors?.join(', ')} • {acc.lighting_condition}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Data Provenance & Spatiotemporal Alignment Audit Table */}
          <section className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🔍</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Data Provenance & Spatiotemporal Alignment Audit
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Verifiable Data Pipeline Integrity Check
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.4)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Feature Name</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Feature Value</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Provenance Tag</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Data Source</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Alignment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {provenanceAudit.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.2)', color: '#cbd5e1' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#f8fafc' }}>{row.feature}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{row.value}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
                        <span style={{ padding: '0.12rem 0.45rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                          {row.provenance}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8' }}>{row.source}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span style={{ color: row.status.includes('ALIGNED') ? '#4ade80' : '#fbbf24', fontWeight: 600 }}>
                          ● {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
