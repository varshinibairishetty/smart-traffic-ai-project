// src/components/DetectionLog.jsx
//
// A table listing individual vehicle detections with Multi-Object Tracking IDs and tripwire flow.

import { recentDetections as defaultDetections } from '../data/sampleData.js'

function confidenceClass(conf) {
  if (conf >= 0.90) return 'conf--high'
  if (conf >= 0.75) return 'conf--medium'
  return 'conf--low'
}

export default function DetectionLog({ detections = null }) {
  const list = detections || defaultDetections

  return (
    <div className="card" id="panel-detections">
      <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="card__title">Live Vehicle Tracking & Detections</span>
          <span className="card__subtitle" style={{ marginLeft: '0.5rem', color: '#38bdf8' }}>
            Multi-Object MOT Engine
          </span>
        </div>
        <span className="badge badge--moderate" style={{ fontSize: '0.75rem' }}>
          {list.length} tracked entities
        </span>
      </div>

      <div className="card__body card__body--flush">
        <table className="det-table" aria-label="Recent vehicle detections">
          <thead>
            <tr>
              <th scope="col">Track ID</th>
              <th scope="col">Time</th>
              <th scope="col">Class</th>
              <th scope="col">YOLO Conf.</th>
              <th scope="col">Tracking & Flow State</th>
            </tr>
          </thead>

          <tbody>
            {list.map(d => (
              <tr key={d.id}>
                <td>
                  <span className="det-id" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                    {d.trackId ? `TRK-#${String(d.trackId).padStart(3, '0')}` : d.id}
                  </span>
                </td>
                <td><span className="det-time">{d.timestamp}</span></td>
                <td>
                  <span className="det-class" style={{ fontWeight: 600 }}>
                    {d.vehicleClass}
                  </span>
                </td>
                <td>
                  <span className={`det-conf ${confidenceClass(d.confidence)}`}>
                    {Math.round(d.confidence * 100)}%
                  </span>
                </td>
                <td>
                  <span className="det-seg" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{d.segment}</span>
                    {d.direction && (
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: d.direction === 'inbound' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                        color: d.direction === 'inbound' ? '#38bdf8' : '#c084fc',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {d.direction === 'inbound' ? '↓ Inbound' : '↑ Outbound'}
                      </span>
                    )}
                    {d.crossedTripwire && (
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.4)'
                      }}>
                        ✓ Tripwire
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
