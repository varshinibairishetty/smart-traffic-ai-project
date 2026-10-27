// src/pages/Cameras.jsx
//
// Cameras page — shows camera feed records derived from the AI detection output.
// Only one video source exists; it is represented as a single camera card.
//
// ⚠️ DATA NOTE: This is not a live RTSP/IP camera stream. Data comes from the
// processed detection_output.json produced by the Python AI service.

import { useState, useEffect } from 'react'
import { fetchCameras } from '../services/api.js'

const RISK_COLOR = {
  Low:      'var(--green)',
  Medium:   'var(--amber)',
  High:     'var(--orange)',
  Critical: 'var(--red)',
}

export default function Cameras() {
  const [cameras, setCameras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const loadCameras = async () => {
    try {
      setLoading(true)
      const data = await fetchCameras()
      setCameras(data.cameras || [])
      setError(null)
    } catch (err) {
      setError(err.message)
      setCameras([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCameras()
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">📹 Cameras</h1>
          <p className="page-subtitle">
            Detection feed sources processed by the AI service
          </p>
        </div>
        <button className="btn-refresh" onClick={loadCameras}>↻ Refresh</button>
      </div>

      {/* Data provenance notice */}
      <div className="demo-banner" role="note">
        <span aria-hidden="true">ℹ️</span>
        <span>
          <strong>Demo Indicator:</strong> Camera metadata is derived from the local video
          file processed by the YOLO AI service. Not a live camera stream.
        </span>
      </div>

      {/* Error state — no fallback to mock data */}
      {error && (
        <div className="demo-banner" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span>
          <span>No camera data available — backend is offline or unreachable. ({error})</span>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="page-empty-state">
          <span className="page-empty-state__icon">⏳</span>
          <p>Loading camera data…</p>
        </div>
      )}

      {/* Empty state — no fallback to mock */}
      {!loading && !error && cameras.length === 0 && (
        <div className="page-empty-state">
          <span className="page-empty-state__icon">📹</span>
          <h2>No Camera Data Available</h2>
          <p>
            Run the AI detection service (<code>python test_detection.py</code>) to
            generate detection output, then restart the backend server.
          </p>
        </div>
      )}

      {/* Camera cards */}
      <div className="cameras-grid">
        {cameras.map(cam => (
          <div className="camera-card card" key={cam.id}>
            <div className="card__header">
              <span className="card__title">{cam.id} — {cam.name}</span>
              <span className={`badge ${cam.status === 'processed' ? 'badge--free' : 'badge--moderate'}`}>
                {cam.status}
              </span>
            </div>
            <div className="card__body">

              {/* Source file */}
              <div className="camera-card__row">
                <span className="camera-card__label">Source File</span>
                <code className="det-seg">{cam.source_file}</code>
              </div>

              {/* Processing stats */}
              <div className="camera-card__row">
                <span className="camera-card__label">Frames Processed</span>
                <span className="camera-card__value">{cam.frames_processed} / {cam.total_frames}</span>
              </div>
              <div className="camera-card__row">
                <span className="camera-card__label">Processing Time</span>
                <span className="camera-card__value">{cam.processing_time_sec}s</span>
              </div>

              {/* Detection summary */}
              <div className="camera-card__divider" />
              <div className="camera-card__row">
                <span className="camera-card__label">Total Detections</span>
                <span className="camera-card__value">{cam.summary.total_detections}</span>
              </div>
              <div className="camera-card__row">
                <span className="camera-card__label">Avg / Frame</span>
                <span className="camera-card__value">{cam.summary.avg_per_frame}</span>
              </div>
              <div className="camera-card__row">
                <span className="camera-card__label">Peak Count</span>
                <span className="camera-card__value">{cam.summary.peak_count}</span>
              </div>

              {/* Vehicle class breakdown mini-list */}
              {cam.summary.by_class && Object.keys(cam.summary.by_class).length > 0 && (
                <div className="camera-card__classes">
                  {Object.entries(cam.summary.by_class).map(([cls, count]) => (
                    <span key={cls} className="camera-card__class-chip">
                      {cls}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Current risk */}
              <div className="camera-card__divider" />
              <div className="camera-card__row">
                <span className="camera-card__label">Current Risk</span>
                <span style={{ fontWeight: 700, color: RISK_COLOR[cam.current_risk.category] }}>
                  {cam.current_risk.score} — {cam.current_risk.category}
                </span>
              </div>

              <div className="camera-card__note">{cam.data_note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
