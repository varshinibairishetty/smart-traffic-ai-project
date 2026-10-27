// src/components/StatCard.jsx
//
// A reusable card that displays one metric (a single big number with a label).
// Used four times on the dashboard for: vehicle count, density, segments, confidence.
//
// Props (inputs to the component):
//   id      — unique HTML id (good for accessibility and testing)
//   icon    — emoji shown in the top-right corner
//   label   — short text above the number, e.g. "Vehicles Detected"
//   value   — the number to display large
//   unit    — small text next to the number, e.g. "vehicles" or "%"
//   accent  — colour theme: 'blue' | 'violet' | 'teal' | 'amber'
//   note    — tiny description below the number, e.g. "in current frame"

export default function StatCard({ id, icon, label, value, unit, accent = 'blue', note }) {
  return (
    <article
      id={id}
      className={`card stat-card stat-card--${accent}`}
      aria-label={`${label}: ${value} ${unit}`}
    >
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__icon" aria-hidden="true">{icon}</span>
      </div>

      <div className="stat-card__value-row">
        <span className="stat-card__value">{value}</span>
        <span className="stat-card__unit">{unit}</span>
      </div>

      {note && <p className="stat-card__note">{note}</p>}
    </article>
  )
}
