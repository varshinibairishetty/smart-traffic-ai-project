// src/components/NavBar.jsx
//
// Top-level navigation bar for multi-page routing.
// Links to: Dashboard (/) | Live Map (/live-map) | Incidents (/incidents) | Cameras (/cameras)

import { NavLink } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/',          label: '📊 Dashboard',  end: true },
  { to: '/live-map',  label: '🗺️ Live Map'            },
  { to: '/incidents', label: '⚠️ Incidents'            },
  { to: '/cameras',   label: '📹 Cameras'              },
]

export default function NavBar() {
  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar__brand">
        <span className="navbar__logo">🚦</span>
        <span className="navbar__title">Smart Traffic AI</span>
      </div>
      <ul className="navbar__links" role="list">
        {NAV_LINKS.map(link => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? 'navbar__link navbar__link--active' : 'navbar__link'
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
