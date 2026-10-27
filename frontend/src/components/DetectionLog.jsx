// src/components/DetectionLog.jsx
//
// A table listing individual vehicle detections.

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
      <div className="card__header">
        <span className="card__title">Recent Detections</span>
        <span className="card__subtitle">{list.length} rows</span>
      </div>

      <div className="card__body card__body--flush">
        <table className="det-table" aria-label="Recent vehicle detections">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Time</th>
              <th scope="col">Class</th>
              <th scope="col">Conf.</th>
              <th scope="col">Segment / Details</th>
            </tr>
          </thead>

          <tbody>
            {list.map(d => (
              <tr key={d.id}>
                <td><span className="det-id">{d.id}</span></td>
                <td><span className="det-time">{d.timestamp}</span></td>
                <td><span className="det-class">{d.vehicleClass}</span></td>
                <td>
                  <span className={`det-conf ${confidenceClass(d.confidence)}`}>
                    {Math.round(d.confidence * 100)}%
                  </span>
                </td>
                <td><span className="det-seg">{d.segment}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
