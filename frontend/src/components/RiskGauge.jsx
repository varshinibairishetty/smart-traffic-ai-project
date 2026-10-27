// src/components/RiskGauge.jsx
//
// Displays the accident risk score as a circular SVG gauge (like a speedometer).
// The arc fills from 0 (empty, no risk) to 100 (full circle, maximum risk).
// Colour mapping follows the 4 project standard categories:
//   0–34  → green  (Low)
//   35–66 → amber  (Medium)
//   67–84 → orange (High)
//   85–100→ red    (Critical)
//
// Built entirely with SVG and CSS — zero external chart library needed.
//
// Props:
//   score — number 0–100
//   level — string: "Low" | "Medium" | "High" | "Critical"
//   details — optional object containing breakdown metrics

function getColor(score) {
  if (score < 35) return '#34d399'  // green  — Low
  if (score < 67) return '#fbbf24'  // amber  — Medium
  if (score < 85) return '#fb923c'  // orange — High
  return '#f87171'                   // red    — Critical
}

export default function RiskGauge({ score, level, details = null }) {
  const color = getColor(score)

  const radius        = 70
  const strokeW       = 11
  const circumference = 2 * Math.PI * radius
  const filled        = (Math.min(Math.max(score, 0), 100) / 100) * circumference
  const empty         = circumference - filled

  const badgeStyle = {
    color,
    background: `${color}18`,
    border: `1px solid ${color}40`,
  }

  return (
    <div className="card" id="panel-risk">
      <div className="card__header">
        <span className="card__title">Accident Risk Score</span>
        <span className="card__subtitle">Rule-based indicator</span>
      </div>

      <div className="card__body risk-gauge">
        {/* ── SVG circular gauge ── */}
        <div
          className="risk-gauge__wrap"
          aria-label={`Risk score: ${score} out of 100, level: ${level}`}
        >
          <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
            {/* Background track */}
            <circle
              cx="90" cy="90" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeW}
            />

            {/* Coloured arc */}
            <circle
              cx="90" cy="90" r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${empty}`}
              transform="rotate(-90 90 90)"
              style={{
                transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease',
              }}
            />

            {/* Soft glow layer */}
            <circle
              cx="90" cy="90" r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeW + 10}
              strokeLinecap="round"
              strokeDasharray={`${filled * 0.7} ${empty + filled * 0.3}`}
              transform="rotate(-90 90 90)"
              opacity="0.10"
              style={{ filter: 'blur(5px)' }}
            />
          </svg>

          {/* Score and /100 label centred inside the ring */}
          <div className="risk-gauge__center">
            <span className="risk-gauge__score" style={{ color }}>{score}</span>
            <span className="risk-gauge__denom">/100</span>
          </div>
        </div>

        {/* Level badge below the ring */}
        <span className="risk-gauge__level-badge" style={badgeStyle}>
          {level} Risk
        </span>

        <p className="risk-gauge__desc">
          Formula: <code>0.55*D + 0.20*V + 0.15*M + 0.10*P</code>
          <br />
          <em>Deterministic engineering heuristic (transparent demo indicator).</em>
        </p>
      </div>
    </div>
  )
}
