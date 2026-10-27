// src/pages/Login.jsx
//
// User Authentication & Role-Based Access Control Login page.
// Allows logging in as Administrator or Control Room Operator with 1-click viva demo shortcuts.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, SEEDED_ACCOUNTS } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, demoLogin, user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (role) => {
    setError(null);
    setSubmitting(true);
    try {
      await demoLogin(role);
      navigate('/');
    } catch (err) {
      setError(`Quick demo login failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Header */}
        <div className="login-card__header">
          <div className="login-card__logo" aria-hidden="true">🛡️</div>
          <h1 className="login-card__title">Security Gateway & RBAC Access</h1>
          <p className="login-card__desc">
            Smart Traffic AI Command & Control Room Portal
          </p>
        </div>

        {/* Currently logged in status */}
        {isAuthenticated && user && (
          <div className="login-active-session">
            <span className="login-active-session__icon">✓</span>
            <div className="login-active-session__info">
              <span className="login-active-session__label">Active Session:</span>
              <strong className="login-active-session__user">{user.name}</strong>
              <span className={`rbac-badge rbac-badge--${user.role}`}>{user.role.toUpperCase()}</span>
            </div>
            <button className="login-active-session__btn" onClick={() => logout()}>
              Log Out
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="login-error-alert" role="alert">
            <span className="login-error-alert__icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Login Cards (For Viva/Academic Demonstrations) */}
        <div className="demo-accounts-section">
          <div className="demo-accounts-header">
            <span className="demo-accounts-badge">VIVA / EVALUATION READY</span>
            <h3 className="demo-accounts-title">Quick Demo Login</h3>
            <p className="demo-accounts-subtitle">Click below to instantly authenticate with pre-configured RBAC roles:</p>
          </div>

          <div className="demo-accounts-grid">
            {/* Admin Card */}
            <button
              type="button"
              className="demo-account-card demo-account-card--admin"
              onClick={() => handleQuickLogin('admin')}
              disabled={submitting}
            >
              <div className="demo-account-card__top">
                <span className="demo-account-card__icon">👑</span>
                <span className="rbac-badge rbac-badge--admin">ADMIN ROLE</span>
              </div>
              <strong className="demo-account-card__name">{SEEDED_ACCOUNTS.admin.label}</strong>
              <p className="demo-account-card__desc">{SEEDED_ACCOUNTS.admin.desc}</p>
              <div className="demo-account-card__footer">
                <code>{SEEDED_ACCOUNTS.admin.email}</code>
                <span className="demo-account-card__action">Sign In →</span>
              </div>
            </button>

            {/* Operator Card */}
            <button
              type="button"
              className="demo-account-card demo-account-card--operator"
              onClick={() => handleQuickLogin('operator')}
              disabled={submitting}
            >
              <div className="demo-account-card__top">
                <span className="demo-account-card__icon">🖥️</span>
                <span className="rbac-badge rbac-badge--operator">OPERATOR ROLE</span>
              </div>
              <strong className="demo-account-card__name">{SEEDED_ACCOUNTS.operator.label}</strong>
              <p className="demo-account-card__desc">{SEEDED_ACCOUNTS.operator.desc}</p>
              <div className="demo-account-card__footer">
                <code>{SEEDED_ACCOUNTS.operator.email}</code>
                <span className="demo-account-card__action">Sign In →</span>
              </div>
            </button>
          </div>
        </div>

        <div className="login-divider">
          <span>or sign in with custom credentials</span>
        </div>

        {/* Standard Credentials Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@traffic.ai"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Verifying Credentials...' : 'Sign In to Traffic AI'}
          </button>
        </form>

        {/* RBAC Privilege Reference */}
        <div className="rbac-info-box">
          <div className="rbac-info-box__title">Role-Based Access Control (RBAC) Policy:</div>
          <ul className="rbac-info-box__list">
            <li><strong>Admin Role:</strong> Allowed full access to all features, including emergency simulation triggers, scenario injection, and incident resolution.</li>
            <li><strong>Operator Role:</strong> View-only access to Live Map telemetry, AI camera feeds, analytical charts, and incident audit logs. Mutation actions are blocked (HTTP 403).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
