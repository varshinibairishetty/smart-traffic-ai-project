// src/components/NavBar.jsx
//
// Top-level navigation bar for multi-page routing, RBAC user status,
// and Automated Notification & Webhook Dispatcher controls.

import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationSettingsModal from './NotificationSettingsModal.jsx';

const NAV_LINKS = [
  { to: '/',              label: '📊 Dashboard',        end: true },
  { to: '/cameras',       label: '📹 Video Analysis'             },
  { to: '/accident-risk', label: '🛡️ Accident Risk'            },
  { to: '/live-map',      label: '🗺️ Live Map'                 },
  { to: '/incidents',     label: '⚠️ Incidents'                 },
  { to: '/analytics',     label: '📈 Analytics'                 },
];

export default function NavBar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  return (
    <>
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

        {/* Action Controls: Notification Dispatcher & User Session */}
        <div className="navbar__auth">
          {/* Notification & Webhook Dispatcher Button */}
          <button
            type="button"
            className="navbar__notif-btn"
            onClick={() => setNotifModalOpen(true)}
            title="Configure automated municipal notifications and webhook dispatch triggers"
          >
            <span className="navbar__notif-icon">🔔</span>
            <span className="navbar__notif-text">Alerts & Webhooks</span>
          </button>

          {/* RBAC User Status */}
          {isAuthenticated && user ? (
            <div className="navbar__user-badge">
              <span
                className={`rbac-pill ${isAdmin ? 'rbac-pill--admin' : 'rbac-pill--operator'}`}
                title={`Role: ${user.role}. ${isAdmin ? 'Full control privileges' : 'View-only monitoring privileges'}`}
              >
                {isAdmin ? '👑 ADMIN' : '🖥️ OPERATOR'}
              </span>
              <span className="navbar__user-name" title={user.email}>
                {user.name}
              </span>
              <button
                className="navbar__logout-btn"
                onClick={logout}
                title="Log out from current session"
              >
                Log Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="navbar__login-link">
              <span>🛡️</span> Sign In / RBAC
            </Link>
          )}
        </div>
      </nav>

      {/* Persistent Notification & Webhook Modal */}
      <NotificationSettingsModal
        isOpen={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
      />
    </>
  );
}
