// src/components/StatCard.jsx
//
// Neo-Glass Command Center Metric Card
// Displays key traffic metrics with bold typography, glowing status dots,
// frosted glassmorphic surface, and vibrant gradient underline highlights.

export default function StatCard({ id, icon, label, value, unit, accent = 'blue', note, status = 'online' }) {
  return (
    <article
      id={id}
      className={`card stat-card stat-card--${accent}`}
      aria-label={`${label}: ${value} ${unit || ''}`}
    >
      {/* Neo-Glass Pulsing Status Indicator Dot */}
      <div className={`stat-card__status-dot stat-card__status-dot--${accent}`} title={`Status: ${status}`} />

      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div className={`stat-card__icon-wrap stat-card__icon-wrap--${accent}`}>
          <span className="stat-card__icon" aria-hidden="true">{icon}</span>
        </div>
      </div>

      <div className="stat-card__value-row">
        <span className="stat-card__value">{value}</span>
        {unit && <span className="stat-card__unit">{unit}</span>}
      </div>

      {note && <p className="stat-card__note">{note}</p>}

      {/* Subtle Gradient Underline Highlight */}
      <div className={`stat-card__highlight-bar stat-card__highlight-bar--${accent}`} aria-hidden="true" />
    </article>
  )
}
