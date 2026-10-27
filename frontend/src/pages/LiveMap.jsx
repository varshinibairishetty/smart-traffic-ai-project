// src/pages/LiveMap.jsx
//
// Live Map page — renders Hyderabad zone markers and geographical geofence bounding boxes
// on a Leaflet/OpenStreetMap base with real-time risk coloring (Green / Amber / Red).
//
// Features:
//   • Point-in-polygon geofencing visualization for HITEC City, Gachibowli, Madhapur, Jubilee Hills
//   • Pulsing geofence perimeter alerts for critical/high risk nodes (Rt >= 67)
//   • Sub-zone spatial tagging (Cyber Towers, Bio-Diversity Flyover, Metro Pillar 1042)
//   • Real-time updates via Socket.io

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup } from 'react-leaflet'
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
  const [zones, setZones]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [showGeofences, setShowGeofences] = useState(true)

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
          <h1 className="page-title">🗺️ Geo-Spatial Live Traffic Map &amp; Geofencing</h1>
          <p className="page-subtitle">
            Hyderabad regional nodes — spatial bounding boxes, perimeter alerts &amp; dynamic risk markers
          </p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showGeofences}
              onChange={(e) => setShowGeofences(e.target.checked)}
            />
            Show Geofence Boundaries
          </label>
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
          <strong>Spatial Engine:</strong> Displays geographical geofencing perimeters. Risk levels
          derive from rule-based formula $R_t$ evaluated across each node's camera telemetry.
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
        <span className="map-legend__item" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ⛶ Geofence Polygons: 6 Active
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

          {/* Render Geofence Boundary Polygons */}
          {showGeofences && zones.map(zone => {
            if (!zone.polygon || zone.polygon.length === 0) return null
            const isHighRisk = zone.score >= 67
            const color = COLOR_MAP[zone.color] || COLOR_MAP.green

            return (
              <Polygon
                key={`fence-${zone.id}`}
                positions={zone.polygon}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: isHighRisk ? 0.35 : 0.12,
                  weight: isHighRisk ? 2.5 : 1.5,
                  dashArray: isHighRisk ? '6 6' : undefined,
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <div style={{ textTransform: 'uppercase', fontSize: '0.65rem', color: color, fontWeight: 800 }}>
                      Spatial Geofence Boundary
                    </div>
                    <strong>{zone.name} Corridor</strong>
                    <div className="map-popup__row">
                      Primary: <strong>{zone.primary_arterial || zone.name}</strong>
                    </div>
                    <div className="map-popup__row">
                      Status: <span className={severityClass(zone.category)}>{zone.category} (Rt: {zone.score})</span>
                    </div>
                    {zone.sub_zones && zone.sub_zones.length > 0 && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-2)' }}>
                        <strong>Sub-zones:</strong> {zone.sub_zones.join(', ')}
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>
            )
          })}

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
                    [{zone.id}] {zone.corridor_type || 'Intersection Node'}
                  </div>
                  <strong>{zone.name}</strong>
                  <div className="map-popup__row">
                    Risk Score: <strong>{zone.score} / 100</strong>
                  </div>
                  <div className="map-popup__row">
                    <span className={severityClass(zone.category)}>{zone.category}</span>
                  </div>
                  <div className="map-popup__row">
                    Primary: <strong>{zone.primary_arterial}</strong>
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
            <span className="card__title">Spatial Geofence Nodes &amp; Sub-Zone Status</span>
            <span className="card__subtitle">{zones.length} perimeters active</span>
          </div>
          <div className="card__body--flush">
            <table className="det-table">
              <thead>
                <tr>
                  <th>Node Corridor</th>
                  <th>Primary Arterial / Sub-Zones</th>
                  <th>Risk (Rt)</th>
                  <th>Category</th>
                  <th>Geofence Center</th>
                  <th>Perimeter Radius</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.id}>
                    <td className="det-class">
                      <strong>{z.name}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {z.corridor_type || 'Tech Corridor'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--blue)' }}>
                        {z.primary_arterial || z.name}
                      </span>
                      {z.sub_zones && z.sub_zones.length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {z.sub_zones.slice(1, 3).join(' • ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ color: COLOR_MAP[z.color], fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {z.score}
                      </span>
                    </td>
                    <td>
                      <span className={severityClass(z.category)}>{z.category}</span>
                    </td>
                    <td className="det-time">{z.lat.toFixed(4)}°N, {z.lon.toFixed(4)}°E</td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {z.radius_meters ? `${(z.radius_meters / 1000).toFixed(1)} km` : '1.2 km'}
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
