// src/pages/Incidents.jsx
//
// Incidents page — shows detection frames where vehicle_count exceeded the
// density threshold, projected as incident events.
//
// ⚠️ DATA NOTE: Incidents are inferred from the local sample video detection
// output (frames where vehicle_count > 10). They are NOT verified real incidents.
// Zone names are assigned by round-robin across Hyderabad zones.

import { useState, useEffect } from 'react'
import { fetchIncidents } from '../services/api.js'

const SEVERITY_BADGE = {
  Low:      'badge badge--free',
  Medium:   'badge badge--moderate',
  High:     'badge badge--heavy',
  Critical: 'badge badge--critical',
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [meta, setMeta]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const loadIncidents = async () => {
    try {
      setLoading(true)
      const data = await fetchIncidents()
      setIncidents(data.incidents || [])
      setMeta({ threshold: data.threshold_used, frames: data.total_frames_checked, at: data.generated_at })
      setError(null)
    } catch (err) {
      setError(err.message)
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIncidents()
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚠️ Incidents</h1>
          <p className="page-subtitle">
            Detection frames where vehicle density exceeded the congestion threshold
          </p>
        </div>
        <button className="btn-refresh" onClick={loadIncidents}>↻ Refresh</button>
      </div>

      {/* Data provenance notice */}
      <div className="demo-banner" role="note">
        <span aria-hidden="true">ℹ️</span>
        <span>
          <strong>Demo Indicator:</strong> Incidents are inferred from video frames where
          vehicle_count &gt; {meta?.threshold ?? 10}. Not verified real-world events.
        </span>
      </div>

      {/* Error state — no fallback to mock data */}
      {error && (
        <div className="demo-banner" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span>
          <span>Backend unavailable — incident data cannot be loaded. ({error})</span>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="page-empty-state">
          <span className="page-empty-state__icon">⏳</span>
          <p>Loading incident data…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && incidents.length === 0 && (
        <div className="page-empty-state">
          <span className="page-empty-state__icon">✅</span>
          <h2>No Incidents Detected</h2>
          <p>
            No detection frames exceeded the threshold of {meta?.threshold ?? 10} vehicles.
            Run the AI detection service on a denser traffic video to generate incidents.
          </p>
        </div>
      )}

      {/* Incident table */}
      {!loading && incidents.length > 0 && (
        <>
          {meta && (
            <p className="page-meta">
              {incidents.length} incidents found across {meta.frames} sampled frames
              (threshold: {meta.threshold} vehicles/frame)
            </p>
          )}
          <div className="card">
            <div className="card__header">
              <span className="card__title">Incident Log</span>
              <span className="card__subtitle">{incidents.length} events</span>
            </div>
            <div className="card__body--flush">
              <table className="det-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Time (s)</th>
                    <th>Frame</th>
                    <th>Vehicles</th>
                    <th>Zone</th>
                    <th>Severity</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map(inc => (
                    <tr key={inc.id}>
                      <td className="det-id">{inc.id}</td>
                      <td className="det-time">{inc.timestamp_sec.toFixed(3)}s</td>
                      <td className="det-time">F#{inc.frame_index}</td>
                      <td style={{ fontWeight: 700, color: 'var(--amber)' }}>{inc.vehicle_count}</td>
                      <td className="det-class">{inc.zone_name}</td>
                      <td>
                        <span className={SEVERITY_BADGE[inc.severity] || 'badge'}>
                          {inc.severity}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                        {inc.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
