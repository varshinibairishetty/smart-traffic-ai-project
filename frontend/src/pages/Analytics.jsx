// src/pages/Analytics.jsx
//
// Dynamic Analytics & Charts page for Smart Traffic AI dashboard.
// Features Recharts visualizations wired to persistent storage & real-time WebSocket updates:
//   1. Macroscopic Traffic Volume & Speed Trend (Dual-Axis Area + Line Chart)
//   2. Hyderabad Intersections Node Comparison (Bar Chart)
//   3. 24-Hour Diurnal Congestion & Peak Hours Timeline (Area Chart)
//   4. Risk Score Category Distribution (Pie / Donut Chart)
//   5. Vehicle Fleet Composition (Bar Chart)

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend
} from 'recharts'
import { fetchAnalyticsSummary } from '../services/api.js'
import socket from '../services/socket.js'

// Custom Dark-Theme Tooltip for Recharts
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null

  return (
    <div style={{
      background: 'rgba(10, 15, 37, 0.95)',
      border: '1px solid rgba(56, 189, 248, 0.35)',
      borderRadius: '8px',
      padding: '0.65rem 0.9rem',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      fontSize: '0.8rem',
      color: '#f1f5f9',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.35rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem' }}>
        {label}
      </div>
      {payload.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color || item.fill }} />
          <span style={{ color: '#94a3b8' }}>{item.name}:</span>
          <span style={{ fontWeight: 700, color: '#ffffff' }}>
            {item.value} {item.unit || ''}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetchAnalyticsSummary()
      setData(res)
      setLastUpdated(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Connect to WebSocket for instant live synchronization
    socket.connect()
    const onLiveUpdate = (payload) => {
      if (payload && payload.analytics_summary) {
        setData(payload.analytics_summary)
        setLastUpdated(new Date().toLocaleTimeString())
        setError(null)
      }
    }

    socket.on('live_traffic_update', onLiveUpdate)
    return () => {
      socket.off('live_traffic_update', onLiveUpdate)
    }
  }, [])

  const kpis = data?.kpis || {}
  const volumeTrends = data?.volume_trends || []
  const nodeComparison = data?.node_comparison || []
  const riskDistribution = data?.risk_distribution || []
  const diurnalPattern = data?.diurnal_pattern || []
  const vehicleComposition = data?.vehicle_composition || []

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Dynamic Traffic Analytics &amp; Visualizations</h1>
          <p className="page-subtitle">
            Historical data aggregation, macroscopic speed physics, and multi-node congestion models
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Live Synced: <strong>{lastUpdated}</strong>
            </span>
          )}
          <button className="btn-refresh" onClick={loadData}>↻ Refresh Data</button>
        </div>
      </div>

      {/* Provenance note */}
      <div className="demo-banner" role="note">
        <span aria-hidden="true">ℹ️</span>
        <span>
          <strong>Analytics Engine:</strong> Aggregated from persistent storage (<code>backend/data/incidents.json</code>)
          and YOLO detections. Speeds estimated using Greenshields macroscopic traffic flow theory ($v = v_f(1 - k/k_j)$).
        </span>
      </div>

      {error && (
        <div className="demo-banner" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>Failed to load analytics: {error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="page-empty-state">
          <span className="page-empty-state__icon">⏳</span>
          <p>Loading analytics data…</p>
        </div>
      )}

      {data && (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              1. SUMMARY KPI METRIC CARDS
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="summary-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="card stat-card">
              <div className="stat-card__label">Estimated Flow Speed</div>
              <div className="stat-card__value" style={{ color: kpis.avg_speed_kmh < 25 ? 'var(--red, #ef4444)' : 'var(--green, #22c55e)' }}>
                {kpis.avg_speed_kmh || 38} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>km/h</span>
              </div>
              <div className="stat-card__note">Greenshields Macroscopic Model</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Traffic Density</div>
              <div className="stat-card__value" style={{ color: kpis.avg_density_pct > 70 ? 'var(--red, #ef4444)' : 'var(--blue, #38bdf8)' }}>
                {kpis.avg_density_pct || 48}%
              </div>
              <div className="stat-card__note">Lane saturation index</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Active Bottlenecks</div>
              <div className="stat-card__value" style={{ color: (kpis.active_incidents || 0) > 0 ? 'var(--red, #ef4444)' : 'var(--green, #22c55e)' }}>
                {kpis.active_incidents || 0}
              </div>
              <div className="stat-card__note">Persistent active alerts</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Incident Resolution</div>
              <div className="stat-card__value" style={{ color: 'var(--green, #22c55e)' }}>
                {kpis.resolution_rate_pct || 0}%
              </div>
              <div className="stat-card__note">{kpis.resolved_incidents || 0} of {kpis.total_incidents || 0} resolved</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Mean Risk Score (Rt)</div>
              <div className="stat-card__value" style={{ color: 'var(--amber, #f59e0b)' }}>
                {kpis.avg_risk_score || 0}
              </div>
              <div className="stat-card__note">{kpis.risk_category || 'Moderate'} Tier (0–100)</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Peak Frame Vehicles</div>
              <div className="stat-card__value" style={{ color: 'var(--purple, #c084fc)' }}>
                {kpis.peak_vehicles_in_frame || 0}
              </div>
              <div className="stat-card__note">Maximum density observed</div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              2. PRIMARY CHARTS ROW: VOLUME vs SPEED & NODE COMPARISON
             ═══════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            
            {/* Chart 1: Volume & Flow Speed Trends */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card__header" style={{ padding: 0, marginBottom: '1rem' }}>
                <div>
                  <span className="card__title">🚗 Volume &amp; Speed Relationship</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Inverse relationship between vehicle queue density and macroscopic travel speed
                  </p>
                </div>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeTrends} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke="#38bdf8" tick={{ fontSize: 11 }} label={{ value: 'Vehicles', angle: -90, position: 'insideLeft', fill: '#38bdf8', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} label={{ value: 'Speed (km/h)', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="vehicles" name="Vehicles" stroke="#38bdf8" fillOpacity={1} fill="url(#colorVehicles)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="speed_kmh" name="Speed (km/h)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Regional Intersections Comparison */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card__header" style={{ padding: 0, marginBottom: '1rem' }}>
                <div>
                  <span className="card__title">📍 Regional Intersections Comparison</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Incident volume and calculated risk scores ($R_t$) across key Hyderabad nodes
                  </p>
                </div>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nodeComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={45} />
                    <YAxis yAxisId="left" stroke="#ef4444" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }} />
                    <Bar yAxisId="left" dataKey="incidents_count" name="Recorded Incidents" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar yAxisId="right" dataKey="risk_score" name="Risk Score (Rt)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              3. SECONDARY CHARTS ROW: DIURNAL PEAK TIMELINE & DISTRIBUTIONS
             ═══════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            
            {/* Chart 3: 24-Hour Diurnal Congestion Timeline */}
            <div className="card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
              <div className="card__header" style={{ padding: 0, marginBottom: '1rem' }}>
                <div>
                  <span className="card__title">🕒 24-Hour Diurnal Congestion &amp; Peak Flow Timeline</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Simulated daily cycle highlighting Cyberabad Morning Rush (09:00–11:00) &amp; Evening Peak (18:00–20:00)
                  </p>
                </div>
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={diurnalPattern} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRiskDiurnal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorVolumeDiurnal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" vertical={false} />
                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="volume_index" name="Volume Index (%)" stroke="#38bdf8" fillOpacity={1} fill="url(#colorVolumeDiurnal)" strokeWidth={2} />
                    <Area type="monotone" dataKey="risk" name="Accident Risk (Rt)" stroke="#ef4444" fillOpacity={1} fill="url(#colorRiskDiurnal)" strokeWidth={2} />
                    <Line type="monotone" dataKey="speed" name="Flow Speed (km/h)" stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Risk Severity Distribution (Donut Chart) */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card__header" style={{ padding: 0, marginBottom: '0.5rem' }}>
                <div>
                  <span className="card__title">⚡ Risk Severity Breakdown</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Persistent incident logs distribution across the 4 risk tiers
                  </p>
                </div>
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {riskDistribution.map(r => (
                  <div key={r.category} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: r.color }} />
                    <span style={{ color: '#94a3b8' }}>{r.category}:</span>
                    <strong style={{ color: '#f1f5f9' }}>{r.count}</strong>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              4. FLEET COMPOSITION & REGIONAL DATA TABLE
             ═══════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            
            {/* Vehicle Fleet Composition */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card__header" style={{ padding: 0, marginBottom: '1rem' }}>
                <div>
                  <span className="card__title">🚛 Detected Vehicle Fleet Composition</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Categorization of detected vehicles affecting heavy-vehicle fleet mix weight ($M_t$)
                  </p>
                </div>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vehicleComposition} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="class_name" type="category" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Detected Count" fill="#38bdf8" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Regional Intersection Detailed Status */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card__header" style={{ padding: 0, marginBottom: '1rem' }}>
                <div>
                  <span className="card__title">🏢 Corridor Node Status Table</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Live operating speed, density and active bottleneck counts
                  </p>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="det-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Node Name</th>
                      <th>Risk (Rt)</th>
                      <th>Density</th>
                      <th>Speed</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeComparison.map(n => (
                      <tr key={n.id}>
                        <td style={{ fontWeight: 600 }}>{n.name}</td>
                        <td>
                          <span className={`badge ${
                            n.severity === 'Critical' ? 'badge--critical' :
                            n.severity === 'High' ? 'badge--heavy' :
                            n.severity === 'Medium' ? 'badge--moderate' : 'badge--free'
                          }`}>
                            {n.risk_score} ({n.severity})
                          </span>
                        </td>
                        <td>{n.density_pct}%</td>
                        <td style={{ fontWeight: 600, color: n.avg_speed_kmh < 25 ? 'var(--red)' : 'var(--green)' }}>
                          {n.avg_speed_kmh} km/h
                        </td>
                        <td>
                          <span style={{ color: n.active_incidents > 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {n.active_incidents}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
