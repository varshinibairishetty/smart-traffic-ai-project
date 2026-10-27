// src/components/VehicleBreakdown.jsx
//
// Displays a horizontal bar chart showing vehicle types and counts.

import { vehicleBreakdown as defaultBreakdown, trafficSummary } from '../data/sampleData.js'

export default function VehicleBreakdown({ data = null }) {
  const breakdownList = data || defaultBreakdown
  const total = breakdownList.reduce((acc, curr) => acc + (curr.count || 0), 0) || trafficSummary.vehicleCount

  return (
    <div className="card" id="panel-breakdown">
      <div className="card__header">
        <span className="card__title">Vehicle Type Breakdown</span>
        <span className="card__subtitle">{total} detected total</span>
      </div>

      <div className="card__body">
        <div className="breakdown__list" role="list">
          {breakdownList.map(v => {
            const count = v.count || 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0

            return (
              <div
                key={v.type}
                className="breakdown__row"
                role="listitem"
                aria-label={`${v.type}: ${count} vehicles, ${pct}%`}
              >
                {/* Icon + type name */}
                <div className="breakdown__label">
                  <span className="breakdown__icon" aria-hidden="true">{v.icon || '🚗'}</span>
                  <span className="breakdown__type">{v.type}</span>
                </div>

                {/* Bar track */}
                <div className="breakdown__bar-track">
                  <div
                    className="breakdown__bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: v.color || '#38bdf8',
                      boxShadow: `0 0 10px ${v.color || '#38bdf8'}44`,
                    }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  />
                </div>

                {/* Count + percentage on the right */}
                <div className="breakdown__count-wrap">
                  <span className="breakdown__count" style={{ color: v.color || '#38bdf8' }}>{count}</span>
                  <span className="breakdown__pct">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
