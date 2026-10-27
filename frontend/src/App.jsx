// src/App.jsx
//
// Root dashboard component integrated with the backend API.
// Fetches live vehicle detections from GET /api/detections with fallback to sample data.

import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import StatCard from './components/StatCard.jsx'
import CongestionStatus from './components/CongestionStatus.jsx'
import RiskGauge from './components/RiskGauge.jsx'
import VehicleBreakdown from './components/VehicleBreakdown.jsx'
import DetectionLog from './components/DetectionLog.jsx'
import { trafficSummary as sampleSummary, DEMO_NOTICE } from './data/sampleData.js'
import { fetchDetections } from './services/api.js'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [liveData, setLiveData] = useState(null)

  const loadTrafficData = async () => {
    try {
      setLoading(true)
      const data = await fetchDetections()
      setLiveData(data)
      setIsLive(true)
      setErrorMsg(null)
    } catch (err) {
      console.warn('Backend unavailable, falling back to static sample data:', err.message)
      setIsLive(false)
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrafficData()
    // Poll backend every 10 seconds for updated detections
    const interval = setInterval(loadTrafficData, 10000)
    return () => clearInterval(interval)
  }, [])

  // Derive display values from live data or fallback to sampleData.js
  let summary = { ...sampleSummary }
  let vehicleBreakdownData = null
  let recentDetectionsList = null
  let dynamicSegments = null

  if (isLive && liveData) {
    const rawSummary = liveData.summary || {}
    const frames = liveData.frames || []
    const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null

    const vehicleCount = latestFrame ? latestFrame.vehicle_count : (rawSummary.total_vehicle_detections || 0)
    
    // Density calculation: estimate percentage based on max 25 vehicles per frame view
    const densityVal = Math.min(Math.round((vehicleCount / 25) * 100), 100)
    let densityLabel = 'Low'
    let congestionStatus = 'Free Flow'
    let congestionLevel = 0

    if (densityVal >= 80) {
      densityLabel = 'High'
      congestionStatus = 'Critical'
      congestionLevel = 4
    } else if (densityVal >= 60) {
      densityLabel = 'High'
      congestionStatus = 'Heavy'
      congestionLevel = 3
    } else if (densityVal >= 40) {
      densityLabel = 'Medium'
      congestionStatus = 'Moderate'
      congestionLevel = 2
    } else if (densityVal >= 20) {
      densityLabel = 'Light'
      congestionStatus = 'Light'
      congestionLevel = 1
    }

    // Extract or calculate risk score from API response
    let riskScore = 42
    let riskLevel = 'Medium'
    let riskDetails = null

    if (liveData.risk && typeof liveData.risk.score === 'number') {
      riskScore = liveData.risk.score
      riskLevel = liveData.risk.category || 'Medium'
      riskDetails = liveData.risk.details || null
    } else {
      // Fallback calculation if backend returned without risk object
      riskScore = Math.min(Math.round(densityVal * 0.55 + (rawSummary.avg_vehicles_per_frame || 10) * 1.5), 100)
      if (riskScore < 35) riskLevel = 'Low'
      else if (riskScore < 67) riskLevel = 'Medium'
      else if (riskScore < 85) riskLevel = 'High'
      else riskLevel = 'Critical'
    }

    // Compute average confidence from latest detections
    let avgConf = 0.85
    if (latestFrame && latestFrame.vehicles && latestFrame.vehicles.length > 0) {
      const totalConf = latestFrame.vehicles.reduce((sum, v) => sum + (v.confidence || 0), 0)
      avgConf = totalConf / latestFrame.vehicles.length
    }

    summary = {
      vehicleCount,
      densityLabel,
      densityValue: densityVal,
      congestionStatus,
      congestionLevel,
      riskScore,
      riskLevel,
      avgConfidence: avgConf,
      activeSegments: 3,
      source: liveData.source || 'Live Detection',
    }

    // Transform by_class summary into breakdown array
    if (rawSummary.by_class) {
      const classMap = {
        car: { label: 'Cars', color: '#38bdf8', icon: '🚗' },
        truck: { label: 'Trucks', color: '#818cf8', icon: '🚛' },
        motorcycle: { label: 'Motorcycles', color: '#34d399', icon: '🏍️' },
        bus: { label: 'Buses', color: '#fbbf24', icon: '🚌' }
      }

      vehicleBreakdownData = Object.entries(rawSummary.by_class).map(([k, count]) => {
        const item = classMap[k.toLowerCase()] || { label: k, color: '#94a3b8', icon: '🚘' }
        return {
          type: item.label,
          count,
          color: item.color,
          icon: item.icon
        }
      })
    }

    // Transform latest frame or all recent frame detections into detection log rows
    if (frames.length > 0) {
      const rows = []
      let counter = 1
      for (const f of frames.slice(-5)) { // look at last 5 sampled frames
        for (const v of f.vehicles || []) {
          rows.push({
            id: `D-${String(counter++).padStart(3, '0')}`,
            timestamp: `${f.timestamp_sec.toFixed(2)}s (F#${f.frame_index})`,
            vehicleClass: v.vehicle_class ? v.vehicle_class.charAt(0).toUpperCase() + v.vehicle_class.slice(1) : 'Vehicle',
            confidence: v.confidence || 0.8,
            segment: `Box: [${v.bbox.x1}, ${v.bbox.y1}]`
          })
        }
      }
      if (rows.length > 0) {
        recentDetectionsList = rows.slice(-10) // display last 10
      }
    }

    // Create segments distributed proportionally from real counts
    dynamicSegments = [
      { id: 'SEG-A', name: 'Main Arterial Lane', vehicles: Math.ceil(vehicleCount * 0.5), status: congestionStatus, level: congestionLevel },
      { id: 'SEG-B', name: 'Eastbound Connector', vehicles: Math.floor(vehicleCount * 0.3), status: congestionLevel > 1 ? 'Moderate' : 'Free Flow', level: Math.max(0, congestionLevel - 1) },
      { id: 'SEG-C', name: 'South Access Ramp', vehicles: Math.floor(vehicleCount * 0.2), status: 'Light', level: Math.max(0, congestionLevel - 2) },
    ]
  }

  return (
    <div className="app">
      {/* ── Sticky top bar ── */}
      <Header isLive={isLive} backendError={errorMsg} />

      {/* ── Status Banner ── */}
      {isLive ? (
        <div className="demo-banner demo-banner--live" role="status">
          <span aria-hidden="true">🟢</span>
          <strong>Live Integration Active:</strong>&nbsp;Streaming data from Express API (<code>{summary.source}</code>). Processed {liveData?.frames_processed || 0} frames.
          <button className="btn-refresh" onClick={loadTrafficData} title="Refresh immediately">↻ Refresh</button>
        </div>
      ) : (
        <div className="demo-banner" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span>
          <span>{DEMO_NOTICE} ({errorMsg || 'Backend is currently unreachable at http://localhost:5000'})</span>
          <button className="btn-refresh" onClick={loadTrafficData}>↻ Retry</button>
        </div>
      )}

      {/* ── Main dashboard content ── */}
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
            note={isLive ? "in current frame view" : "in the latest video frame"}
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
          <RiskGauge
            score={summary.riskScore}
            level={summary.riskLevel}
          />
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
          <strong>Phase 7 — Frontend-Backend Integration.</strong>&nbsp;
          Status: {isLive ? <span style={{ color: 'var(--green)' }}>Connected (http://localhost:5000/api/detections)</span> : <span style={{ color: 'var(--amber)' }}>Using Fallback Data</span>}
        </p>
        <p>
          Video source:&nbsp;
          <code>{summary.source}</code>
        </p>
      </footer>
    </div>
  )
}
