// src/pages/LiveMap.jsx
//
// Live Map page — renders Hyderabad zone markers on a Leaflet/OpenStreetMap base.
// Zone risk colours (green / amber / red) are fetched from GET /api/zones every 10 s.
//
// ⚠️  DATA NOTE: Zone risk scores are derived by multiplying the global rule-based
// risk score (calculated from the local sample video) by per-zone weight multipliers.
// They are NOT real sensor readings or GPS-tagged detections.

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchZones } from '../services/api.js'

// Colour tokens matching the app's design system
const COLOR_MAP = {
  green: '#34d399',
  amber: '#fbbf24',
  red:   '#f87171',
}

// Badge class matching existing CSS in index.css
function severityClass(category) {
  if (category === 'Critical' || category === 'High') return 'badge badge--critical'
  if (category === 'Medium') return 'badge badge--moderate'
  return 'badge badge--free'
}

export default function LiveMap() {
  const [zones, setZones]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadZones = async () => {
    try {
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
    const interval = setInterval(loadZones, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">🗺️ Live Traffic Map</h1>
          <p className="page-subtitle">
            Hyderabad zone risk status — updated every 10 seconds
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
          <strong>Demo Indicator:</strong> Zone risk scores are derived from the global
          rule-based score × zone weight multipliers. Not real GPS sensor data.
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
          center={[17.445, 78.38]}
          zoom={13}
          style={{ height: '100%', width: '100%', borderRadius: '10px' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {zones.map(zone => (
            <CircleMarker
              key={zone.id}
              center={[zone.lat, zone.lon]}
              radius={22}
              pathOptions={{
                color:       COLOR_MAP[zone.color] || COLOR_MAP.green,
                fillColor:   COLOR_MAP[zone.color] || COLOR_MAP.green,
                fillOpacity: 0.45,
                weight:      2,
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{zone.name}</strong>
                  <div className="map-popup__row">
                    Risk Score: <strong>{zone.score} / 100</strong>
                  </div>
                  <div className="map-popup__row">
                    <span className={severityClass(zone.category)}>{zone.category}</span>
                  </div>
                  <div className="map-popup__note">{zone.data_note}</div>
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
            <span className="card__title">Zone Status Table</span>
            <span className="card__subtitle">{zones.length} zones monitored</span>
          </div>
          <div className="card__body--flush">
            <table className="det-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Risk Score</th>
                  <th>Category</th>
                  <th>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.id}>
                    <td className="det-class">{z.name}</td>
                    <td>
                      <span style={{ color: COLOR_MAP[z.color], fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {z.score}
                      </span>
                    </td>
                    <td>
                      <span className={severityClass(z.category)}>{z.category}</span>
                    </td>
                    <td className="det-time">{z.lat}°N, {z.lon}°E</td>
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
