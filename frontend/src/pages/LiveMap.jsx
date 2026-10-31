// src/pages/LiveMap.jsx
//
// Live Map page — renders Hyderabad zone markers on a Leaflet/OpenStreetMap
// base with real-time risk coloring (Green / Amber / Red).
//
// Features:
//   • Hyderabad regional nodes: HITEC City, Gachibowli, Madhapur, Kondapur, Jubilee Hills, Banjara Hills
//   • Real-time updates via Socket.io
//   • Interactive marker popups displaying calculated risk scores (Rt) and categories

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchZones } from '../services/api.js'
import socket from '../services/socket.js'

// Colour tokens matching the app's design system
const COLOR_MAP = {
  green: '#34d399',
  amber: '#fbbf24',
  red:   '#f87171',
}

function severityClass(category) {
  if (category === 'Critical' || category === 'High') return 'badge badge--critical'
  if (category === 'Medium') return 'badge badge--moderate'
  return 'badge badge--free'
}

export default function LiveMap() {
  const [zones, setZones]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadZones = async () => {
    try {
      setLoading(true)
      const data = await fetchZones()
      setZones(data.zones || [])
      setLastUpdated(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadZones()

    // Connect to WebSocket for instant real-time zone and color updates
    socket.connect()
    const onLiveUpdate = (payload) => {
      if (payload && payload.zones && payload.zones.length > 0) {
        setZones(payload.zones)
        setLastUpdated(new Date().toLocaleTimeString())
        setError(null)
        setLoading(false)
      }
    }

    socket.on('live_traffic_update', onLiveUpdate)
    const interval = setInterval(loadZones, 10000)

    return () => {
      clearInterval(interval)
      socket.off('live_traffic_update', onLiveUpdate)
    }
  }, [])

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🗺️ Live Traffic Map</h1>
          <p className="page-subtitle">
            Hyderabad regional nodes — real-time risk scores and traffic light indicators
          </p>
        </div>
        <div className="page-header-right">
          {lastUpdated && (
            <span className="page-timestamp">Last updated: {lastUpdated}</span>
          )}
          <button className="btn-refresh" onClick={loadZones}>↻ Refresh</button>
        </div>
      </div>

      {/* Demo data notice */}
      <div className="demo-banner" role="note">
        <span aria-hidden="true">ℹ️</span>
        <span>
          <strong>Live Node Status:</strong> Risk scores ($R_t$) are dynamically evaluated from vehicle detections,
          fleet mix penalties, and corridor weights.
        </span>
      </div>

      {error && (
        <div className="demo-banner" role="alert" aria-live="polite">
          <span aria-hidden="true">⚠️</span>
          <span>Backend unavailable — zone data cannot be loaded. ({error})</span>
        </div>
      )}

      {/* Colour legend */}
      <div className="map-legend">
        <span className="map-legend__item">
          <span className="map-legend__dot" style={{ background: COLOR_MAP.green }} />
          Low risk (0–34)
        </span>
        <span className="map-legend__item">
          <span className="map-legend__dot" style={{ background: COLOR_MAP.amber }} />
          Medium risk (35–66)
        </span>
        <span className="map-legend__item">
          <span className="map-legend__dot" style={{ background: COLOR_MAP.red }} />
          High / Critical (67–100)
        </span>
      </div>

      {/* Leaflet map — centred on HITEC City corridor */}
      <div className="map-wrapper">
        <MapContainer
          center={[17.442, 78.382]}
          zoom={13}
          style={{ height: '100%', width: '100%', borderRadius: '10px' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render Zone Node Center Markers */}
          {zones.map(zone => (
            <CircleMarker
              key={zone.id}
              center={[zone.lat, zone.lon]}
              radius={20}
              pathOptions={{
                color:       COLOR_MAP[zone.color] || COLOR_MAP.green,
                fillColor:   COLOR_MAP[zone.color] || COLOR_MAP.green,
                fillOpacity: 0.55,
                weight:      2.5,
              }}
            >
              <Popup>
                <div className="map-popup">
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    [{zone.id}] Traffic Node
                  </div>
                  <strong>{zone.name}</strong>
                  <div className="map-popup__row">
                    Risk Score: <strong>{zone.score} / 100</strong>
                  </div>
                  <div className="map-popup__row">
                    Category: <span className={severityClass(zone.category)}>{zone.category}</span>
                  </div>
                  <div className="map-popup__note">{zone.data_note}</div>
                  <div style={{ marginTop: '0.45rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Link to="/accident-risk" style={{ color: '#38bdf8', fontSize: '0.74rem', textDecoration: 'none', fontWeight: 600 }}>
                      🛡️ View Mode B Risk Analysis ➔
                    </Link>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Zone table below the map */}
      {!loading && zones.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card__header">
            <span className="card__title">Regional Traffic Nodes &amp; Risk Status</span>
            <span className="card__subtitle">{zones.length} active nodes</span>
          </div>
          <div className="card__body--flush">
            <table className="det-table">
              <thead>
                <tr>
                  <th>Node Corridor</th>
                  <th>Coordinates</th>
                  <th>Risk Score (Rt)</th>
                  <th>Category</th>
                  <th>Status Color</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.id}>
                    <td className="det-class">
                      <strong>{z.name}</strong>
                    </td>
                    <td className="det-time">{z.lat.toFixed(4)}°N, {z.lon.toFixed(4)}°E</td>
                    <td>
                      <span style={{ color: COLOR_MAP[z.color], fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {z.score}
                      </span>
                    </td>
                    <td>
                      <span className={severityClass(z.category)}>{z.category}</span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: COLOR_MAP[z.color] }}>
                        ● {z.color}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
