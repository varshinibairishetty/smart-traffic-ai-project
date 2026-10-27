// src/App.jsx
//
// Root dashboard component — Phase 9: Real-Time WebSocket Integration.
//
// Data strategy (priority order):
//   1. Socket.io 'live_traffic_update' events  — instant push from backend
//   2. HTTP GET /api/detections (initial load) — baseline on first mount
//   3. Static sampleData.js                   — fallback when both are unreachable
//
// The 10-second HTTP polling loop has been removed; Socket.io handles
// continuous updates instead. HTTP fetch is still used on first mount to
// avoid a blank dashboard before the WebSocket handshake completes.

import { useState, useEffect, useRef } from 'react'
import Header from './components/Header.jsx'
import StatCard from './components/StatCard.jsx'
import CongestionStatus from './components/CongestionStatus.jsx'
import RiskGauge from './components/RiskGauge.jsx'
import VehicleBreakdown from './components/VehicleBreakdown.jsx'
import DetectionLog from './components/DetectionLog.jsx'
import { trafficSummary as sampleSummary, DEMO_NOTICE } from './data/sampleData.js'
import { fetchDetections } from './services/api.js'
import useTrafficSocket from './hooks/useTrafficSocket.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Derive all display-ready values from a raw detection payload.
// Accepts either the REST /api/detections response or a socket live_traffic_update payload —
// both share the same schema fields.
function deriveDisplayValues(rawData) {
  if (!rawData) return null

  const rawSummary  = rawData.summary   || {}
  const frames      = rawData.frames    || []
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null

  const vehicleCount = latestFrame
    ? latestFrame.vehicle_count
    : (rawSummary.avg_vehicles_per_frame || 0)

  // Density: normalised against 25-vehicle saturation threshold (K_sat)
  const densityVal = Math.min(Math.round((vehicleCount / 25) * 100), 100)
  let densityLabel   = 'Low'
  let congestionStatus = 'Free Flow'
  let congestionLevel  = 0

  if (densityVal >= 80)      { densityLabel = 'High';   congestionStatus = 'Critical'; congestionLevel = 4 }
  else if (densityVal >= 60) { densityLabel = 'High';   congestionStatus = 'Heavy';    congestionLevel = 3 }
  else if (densityVal >= 40) { densityLabel = 'Medium'; congestionStatus = 'Moderate'; congestionLevel = 2 }
  else if (densityVal >= 20) { densityLabel = 'Light';  congestionStatus = 'Light';    congestionLevel = 1 }

  // Risk from backend rule-based calculator
  let riskScore = 42
  let riskLevel = 'Medium'
  if (rawData.risk && typeof rawData.risk.score === 'number') {
    riskScore = rawData.risk.score
    riskLevel = rawData.risk.category || 'Medium'
  } else {
    riskScore = Math.min(Math.round(densityVal * 0.55 + (rawSummary.avg_vehicles_per_frame || 10) * 1.5), 100)
    if      (riskScore < 35) riskLevel = 'Low'
    else if (riskScore < 67) riskLevel = 'Medium'
    else if (riskScore < 85) riskLevel = 'High'
    else                     riskLevel = 'Critical'
  }

  // Average YOLO confidence from the latest frame
  let avgConf = 0.85
  if (latestFrame?.vehicles?.length > 0) {
    avgConf = latestFrame.vehicles.reduce((s, v) => s + (v.confidence || 0), 0) / latestFrame.vehicles.length
  }

  // Vehicle class breakdown
  let vehicleBreakdownData = null
  if (rawSummary.by_class) {
    const classMap = {
      car:        { label: 'Cars',        color: '#38bdf8', icon: '🚗' },
      truck:      { label: 'Trucks',      color: '#818cf8', icon: '🚛' },
      motorcycle: { label: 'Motorcycles', color: '#34d399', icon: '🏍️' },
      bus:        { label: 'Buses',       color: '#fbbf24', icon: '🚌' },
    }
    vehicleBreakdownData = Object.entries(rawSummary.by_class).map(([k, count]) => {
      const item = classMap[k.toLowerCase()] || { label: k, color: '#94a3b8', icon: '🚘' }
      return { type: item.label, count, color: item.color, icon: item.icon }
    })
  }

  // Detection log rows from the last 5 frames
  let recentDetectionsList = null
  if (frames.length > 0) {
    const rows = []
    let counter = 1
    for (const f of frames.slice(-5)) {
      for (const v of f.vehicles || []) {
        rows.push({
          id:           `D-${String(counter++).padStart(3, '0')}`,
          timestamp:    `${f.timestamp_sec.toFixed(2)}s (F#${f.frame_index})`,
          vehicleClass: v.vehicle_class
            ? v.vehicle_class.charAt(0).toUpperCase() + v.vehicle_class.slice(1)
            : 'Vehicle',
          confidence: v.confidence || 0.8,
          segment:    `Box: [${v.bbox.x1}, ${v.bbox.y1}]`,
        })
      }
    }
    if (rows.length > 0) recentDetectionsList = rows.slice(-10)
  }

  // Road segments derived proportionally
  const dynamicSegments = [
    { id: 'SEG-A', name: 'Main Arterial Lane',  vehicles: Math.ceil(vehicleCount * 0.5),  status: congestionStatus,                                    level: congestionLevel },
    { id: 'SEG-B', name: 'Eastbound Connector', vehicles: Math.floor(vehicleCount * 0.3), status: congestionLevel > 1 ? 'Moderate' : 'Free Flow',       level: Math.max(0, congestionLevel - 1) },
    { id: 'SEG-C', name: 'South Access Ramp',   vehicles: Math.floor(vehicleCount * 0.2), status: 'Light',                                              level: Math.max(0, congestionLevel - 2) },
  ]

  return {
    summary: {
      vehicleCount,
      densityLabel,
      densityValue:  densityVal,
      congestionStatus,
      congestionLevel,
      riskScore,
      riskLevel,
      avgConfidence: avgConf,
      activeSegments: 3,
      source: rawData.source || 'Live Detection',
    },
    vehicleBreakdownData,
    recentDetectionsList,
    dynamicSegments,
    framesProcessed: rawData.frames_processed || 0,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  // HTTP baseline state
  const [httpData,  setHttpData]  = useState(null)
  const [httpError, setHttpError] = useState(null)

  // Socket.io real-time state
  const { socketData, socketConnected, socketError, lastEventAt } = useTrafficSocket()

  // Track how many socket events have arrived (for the status banner)
  const eventCountRef = useRef(0)
  const [eventCount, setEventCount] = useState(0)

  // ── Initial HTTP load (runs once on mount) ────────────────────────────────
  useEffect(() => {
    fetchDetections()
      .then(data => { setHttpData(data); setHttpError(null) })
      .catch(err  => { setHttpError(err.message) })
  }, [])

  // ── Count incoming socket events ──────────────────────────────────────────
  useEffect(() => {
    if (socketData) {
      eventCountRef.current += 1
      setEventCount(eventCountRef.current)
    }
  }, [socketData])

  // ── Decide which data source drives the UI ────────────────────────────────
  // Priority: live socket payload > initial HTTP payload > sample fallback
  const activeRaw = socketData || httpData
  const isLive    = socketConnected || !!httpData
  const isSocket  = socketConnected && !!socketData

  const derived = deriveDisplayValues(activeRaw)

  const summary             = derived?.summary             || { ...sampleSummary }
  const vehicleBreakdownData= derived?.vehicleBreakdownData || null
  const recentDetectionsList= derived?.recentDetectionsList || null
  const dynamicSegments     = derived?.dynamicSegments      || null
  const framesProcessed     = derived?.framesProcessed      || 0

  // Error to surface: socket error takes priority only if HTTP also failed
  const displayError = !isLive ? (socketError || httpError) : null

  // ─── Status banner label ──────────────────────────────────────────────────
  function statusBanner() {
    if (socketData?.is_scenario) {
      return (
        <div className="demo-banner demo-banner--live demo-banner--socket" role="status">
          <span aria-hidden="true">🎬</span>
          <strong>Active Simulation Scenario:</strong>&nbsp;
          <span>{socketData.scenario_code} — {socketData.scenario_title}</span>
          <span className="banner-scenario-desc">({socketData.scenario_description})</span>
        </div>
      )
    }
    if (isSocket) {
      return (
        <div className="demo-banner demo-banner--live demo-banner--socket" role="status">
          <span aria-hidden="true">⚡</span>
          <strong>WebSocket Live:</strong>&nbsp;
          Receiving real-time updates via Socket.io&nbsp;
          (<code>{summary.source}</code>).&nbsp;
          {eventCount} event{eventCount !== 1 ? 's' : ''} received.
          {lastEventAt && <span className="banner-timestamp">Last: {new Date(lastEventAt).toLocaleTimeString()}</span>}
        </div>
      )
    }
    if (isLive) {
      return (
        <div className="demo-banner demo-banner--live" role="status">
          <span aria-hidden="true">🟢</span>
          <strong>HTTP Live (WebSocket connecting…):</strong>&nbsp;
          Showing data from REST API (<code>{summary.source}</code>). Processed {framesProcessed} frames.
        </div>
      )
    }
    return (
      <div className="demo-banner" role="alert" aria-live="polite">
        <span aria-hidden="true">⚠️</span>
        <span>{DEMO_NOTICE} ({displayError || 'Backend unreachable at http://localhost:5000'})</span>
      </div>
    )
  }

  return (
    <div className="app">
      {/* ── Dashboard sub-header (status + clock) ── */}
      <Header isLive={isLive} backendError={displayError} />

      {/* ── Status Banner ── */}
      {statusBanner()}

      {/* ── Real-Time Viva Emergency / Congestion Alert Banner ── */}
      {summary.riskLevel === 'Critical' && (
        <div className="viva-alert-banner viva-alert-banner--critical" role="alert">
          <span className="viva-alert-pulse">🚨</span>
          <div>
            <strong>CRITICAL TRAFFIC ACCIDENT &amp; CONGESTION ALERT:</strong>&nbsp;
            Accident Risk Score reached {summary.riskScore}/100.
            Severe queue buildup and high conflict potential detected in the arterial corridor. Automated signal preemption advised.
          </div>
        </div>
      )}
      {summary.riskLevel === 'High' && (
        <div className="viva-alert-banner viva-alert-banner--high" role="alert">
          <span className="viva-alert-pulse">⚠️</span>
          <div>
            <strong>ELEVATED CONGESTION ADVISORY:</strong>&nbsp;
            Accident Risk Score at {summary.riskScore}/100 (High). Traffic density approaching capacity saturation ({summary.densityValue}%).
          </div>
        </div>
      )}

      {/* ── Main dashboard ── */}
      <main className="dashboard" aria-label="Traffic management dashboard">

        {/* Row 1 — four top-level metric cards */}
        <section className="stats-grid" aria-label="Key traffic metrics">
          <StatCard
            id="stat-vehicle-count"
            icon="🚗"
            label="Vehicles Detected"
            value={summary.vehicleCount}
            unit="vehicles"
            accent="blue"
            note={isSocket ? '⚡ live socket frame' : isLive ? 'in current frame view' : 'in the latest video frame'}
          />
          <StatCard
            id="stat-density"
            icon="📊"
            label="Traffic Density"
            value={summary.densityValue}
            unit="%"
            accent="violet"
            note={`Level: ${summary.densityLabel}`}
          />
          <StatCard
            id="stat-segments"
            icon="🛣️"
            label="Active Segments"
            value={summary.activeSegments}
            unit="roads"
            accent="teal"
            note="road segments monitored"
          />
          <StatCard
            id="stat-confidence"
            icon="🎯"
            label="Avg. Confidence"
            value={Math.round(summary.avgConfidence * 100)}
            unit="%"
            accent="amber"
            note="YOLO detection accuracy"
          />
        </section>

        {/* Row 2 — congestion breakdown and risk gauge */}
        <section className="mid-grid" aria-label="Congestion and risk indicators">
          <CongestionStatus segments={dynamicSegments} congestionLevel={summary.congestionLevel} />
          <RiskGauge score={summary.riskScore} level={summary.riskLevel} />
        </section>

        {/* Row 3 — vehicle type breakdown and individual detection log */}
        <section className="bottom-grid" aria-label="Vehicle breakdown and detection log">
          <VehicleBreakdown data={vehicleBreakdownData} />
          <DetectionLog detections={recentDetectionsList} />
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="footer" role="contentinfo">
        <p>
          <strong>Phase 9 — Real-Time WebSocket Integration.</strong>&nbsp;
          {isSocket
            ? <span style={{ color: 'var(--green)' }}>⚡ Socket.io connected (ws://localhost:5000)</span>
            : isLive
              ? <span style={{ color: 'var(--amber)' }}>HTTP baseline active (WebSocket connecting…)</span>
              : <span style={{ color: 'var(--amber)' }}>Using Fallback Data</span>
          }
        </p>
        <p>Video source:&nbsp;<code>{summary.source}</code></p>
      </footer>
    </div>
  )
}
