// src/components/CongestionStatus.jsx
//
// Shows congestion status and segment vehicle distribution.

import { trafficSummary, roadSegments as defaultSegments } from '../data/sampleData.js'

const LEVEL_META = {
  0: { cls: 'badge--free',     label: 'Free Flow' },
  1: { cls: 'badge--light',    label: 'Light'     },
  2: { cls: 'badge--moderate', label: 'Moderate'  },
  3: { cls: 'badge--heavy',    label: 'Heavy'     },
  4: { cls: 'badge--critical', label: 'Critical'  },
}

const BAR_COLOR = {
  0: '#34d399',
  1: '#2dd4bf',
  2: '#fbbf24',
  3: '#fb923c',
  4: '#f87171',
}

const MAX_VEHICLES_PER_SEGMENT = 25

export default function CongestionStatus({ segments = null, congestionLevel = null }) {
  const segList = segments || defaultSegments
  const activeLevel = congestionLevel !== null ? congestionLevel : trafficSummary.congestionLevel
  const overall = LEVEL_META[activeLevel] || LEVEL_META[2]

  return (
    <div className="card" id="panel-congestion">
      <div className="card__header">
        <span className="card__title">Congestion Status</span>
        <span className={`badge ${overall.cls}`}>{overall.label}</span>
      </div>

      <div className="card__body">
        <div className="congestion__segments" role="list">
          {segList.map(seg => {
            const meta = LEVEL_META[seg.level] || LEVEL_META[2]
            const barWidth = Math.min((seg.vehicles / MAX_VEHICLES_PER_SEGMENT) * 100, 100)
            const barColor = BAR_COLOR[seg.level] || '#fbbf24'

            return (
              <div
                key={seg.id}
                className="segment-row"
                role="listitem"
                aria-label={`${seg.name}: ${seg.status} congestion, ${seg.vehicles} vehicles`}
              >
                <div className="segment-row__info">
                  <div className="segment-row__name">{seg.name}</div>
                  <div className="segment-row__id">{seg.id}</div>
                  <div className="segment-row__bar-track">
                    <div
                      className="segment-row__bar-fill"
                      style={{ width: `${barWidth}%`, background: barColor }}
                      role="progressbar"
                      aria-valuenow={barWidth}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                </div>

                <div className="segment-row__right">
                  <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  <span className="segment-row__count">{seg.vehicles} veh.</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
