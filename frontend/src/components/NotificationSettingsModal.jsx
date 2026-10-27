// src/components/NotificationSettingsModal.jsx
//
// Automated Incident Notification & Webhook Dispatcher Modal / Settings Panel.
// Allows operators to configure notification channels (Email, SMS, Municipal Webhook),
// adjust the minimum risk trigger threshold (Rt >= 70), send test dispatches,
// and inspect the audit log history of dispatched alerts in real-time.

import { useState, useEffect } from 'react';
import socket from '../services/socket.js';
import {
  fetchNotifications,
  fetchNotificationConfig,
  updateNotificationConfig,
  triggerTestNotification
} from '../services/api.js';

export default function NotificationSettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'history'
  const [config, setConfig] = useState({
    enabled: true,
    minRiskScore: 70,
    channels: { email: true, sms: true, webhook: true },
    recipients: { email: 'controlroom@traffic.hyderabad.gov.in', sms: '+91-9876543210' },
    webhookUrl: 'http://localhost:5000/api/notifications/mock-webhook'
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState(null);
  const [channelFilter, setChannelFilter] = useState('all');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Load configuration and recent dispatches when opened
  const loadData = async () => {
    try {
      setLoading(true);
      const [cfgData, notifData] = await Promise.all([
        fetchNotificationConfig(),
        fetchNotifications({ limit: 50 })
      ]);
      if (cfgData?.config) setConfig(cfgData.config);
      if (notifData?.notifications) setNotifications(notifData.notifications);
    } catch (err) {
      console.warn('Failed loading notification data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Listen to WebSocket broadcasts for real-time notification dispatches
  useEffect(() => {
    const handleDispatched = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      showToast(`🔔 Outgoing Alert Dispatched: ${notif.sub_zone || notif.node_location} (Rt=${notif.risk_score})`);
    };

    socket.on('notification_dispatched', handleDispatched);
    return () => {
      socket.off('notification_dispatched', handleDispatched);
    };
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateNotificationConfig(config);
      if (res.config) setConfig(res.config);
      showToast('✓ Notification settings saved successfully.');
    } catch (err) {
      showToast(`⚠️ Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestDispatch = async () => {
    try {
      setTesting(true);
      const res = await triggerTestNotification({
        node_location: 'HITEC City',
        sub_zone: 'Cyber Towers Junction Flyover',
        risk_score: 89
      });
      if (res.notification) {
        setNotifications((prev) => [res.notification, ...prev]);
        showToast(`✓ Test Alert Dispatched to [${res.notification.channels.join(', ')}]!`);
      }
    } catch (err) {
      showToast(`⚠️ Test dispatch failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (channelFilter === 'all') return true;
    return n.channels?.includes(channelFilter);
  });

  return (
    <div className="notif-modal-backdrop" onClick={onClose}>
      <div className="notif-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Modal Header */}
        <div className="notif-modal-header">
          <div className="notif-modal-title-wrap">
            <span className="notif-modal-icon">🔔</span>
            <div>
              <h2 className="notif-modal-title">Incident Notification & Webhook Dispatcher</h2>
              <span className="notif-modal-subtitle">
                Autonomous multi-channel municipal alert routing (Rt &ge; {config.minRiskScore})
              </span>
            </div>
          </div>
          <button className="notif-modal-close" onClick={onClose} title="Close window">✕</button>
        </div>

        {/* Status Toast */}
        {toast && (
          <div className="notif-modal-toast" role="status">
            <span>{toast}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="notif-modal-tabs">
          <button
            className={`notif-modal-tab ${activeTab === 'settings' ? 'notif-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Channel Settings & Triggers
          </button>
          <button
            className={`notif-modal-tab ${activeTab === 'history' ? 'notif-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 Dispatch History Logs ({notifications.length})
          </button>
        </div>

        {/* Tab 1: Settings Form */}
        {activeTab === 'settings' && (
          <form className="notif-modal-body" onSubmit={handleSaveConfig}>
            {/* Master Switch */}
            <div className="notif-toggle-row">
              <div>
                <strong>Automated Alert Dispatching</strong>
                <p className="notif-toggle-desc">Automatically evaluate incoming high-risk incidents and broadcast to municipal services</p>
              </div>
              <label className="notif-switch">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                />
                <span className="notif-slider"></span>
              </label>
            </div>

            {/* Risk Threshold Slider */}
            <div className="notif-form-section">
              <label className="notif-label">
                <span>Minimum Risk Score Trigger Threshold:</span>
                <strong style={{ color: config.minRiskScore >= 70 ? 'var(--red)' : 'var(--amber)', fontFamily: 'var(--mono)' }}>
                  Rt &ge; {config.minRiskScore}
                </strong>
              </label>
              <input
                type="range"
                min="35"
                max="95"
                step="5"
                value={config.minRiskScore}
                onChange={(e) => setConfig({ ...config, minRiskScore: parseInt(e.target.value, 10) })}
                className="notif-range-slider"
              />
              <span className="notif-help-text">
                Alerts are triggered for incidents at or exceeding Rt {config.minRiskScore} (High/Critical severities).
              </span>
            </div>

            {/* Channel Toggles & Config */}
            <div className="notif-channels-grid">
              {/* Channel 1: Email */}
              <div className="notif-channel-card">
                <div className="notif-channel-card__top">
                  <div className="notif-channel-card__title">
                    <span>📧 Municipal Email Advisory</span>
                    <span className="rbac-micro-pill rbac-micro-pill--admin">MOCK CHANNEL</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.channels.email}
                    onChange={(e) => setConfig({
                      ...config,
                      channels: { ...config.channels, email: e.target.checked }
                    })}
                  />
                </div>
                <p className="notif-channel-desc">Dispatches formatted advisory emails to municipal traffic control rooms.</p>
                <input
                  type="email"
                  className="notif-channel-input"
                  value={config.recipients.email || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    recipients: { ...config.recipients, email: e.target.value }
                  })}
                  placeholder="recipient@traffic.hyderabad.gov.in"
                />
              </div>

              {/* Channel 2: SMS */}
              <div className="notif-channel-card">
                <div className="notif-channel-card__top">
                  <div className="notif-channel-card__title">
                    <span>📱 SMS Emergency Alert</span>
                    <span className="rbac-micro-pill rbac-micro-pill--admin">MOCK CHANNEL</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.channels.sms}
                    onChange={(e) => setConfig({
                      ...config,
                      channels: { ...config.channels, sms: e.target.checked }
                    })}
                  />
                </div>
                <p className="notif-channel-desc">Dispatches high-priority SMS notifications to mobile response units.</p>
                <input
                  type="text"
                  className="notif-channel-input"
                  value={config.recipients.sms || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    recipients: { ...config.recipients, sms: e.target.value }
                  })}
                  placeholder="+91-9876543210"
                />
              </div>

              {/* Channel 3: Outgoing Webhook */}
              <div className="notif-channel-card notif-channel-card--wide">
                <div className="notif-channel-card__top">
                  <div className="notif-channel-card__title">
                    <span>🌐 Municipal Police Outgoing Webhook</span>
                    <span className="rbac-micro-pill rbac-micro-pill--admin">REST HTTP POST</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.channels.webhook}
                    onChange={(e) => setConfig({
                      ...config,
                      channels: { ...config.channels, webhook: e.target.checked }
                    })}
                  />
                </div>
                <p className="notif-channel-desc">Posts JSON payload directly to registered municipal endpoints (GHMC / Cyberabad Traffic Police).</p>
                <input
                  type="url"
                  className="notif-channel-input"
                  value={config.webhookUrl || ''}
                  onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                  placeholder="http://localhost:5000/api/notifications/mock-webhook"
                />
              </div>
            </div>

            {/* Actions Footer */}
            <div className="notif-modal-actions">
              <button
                type="button"
                className="notif-btn notif-btn--test"
                onClick={handleTestDispatch}
                disabled={testing}
              >
                {testing ? 'Dispatching Test…' : '⚡ Send Test Alert'}
              </button>
              <button
                type="submit"
                className="notif-btn notif-btn--save"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Dispatch Configuration'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Dispatch History Logs */}
        {activeTab === 'history' && (
          <div className="notif-modal-body">
            {/* Filter Pills */}
            <div className="notif-history-filters">
              <span>Filter by Channel:</span>
              {['all', 'email', 'sms', 'webhook'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`notif-filter-pill ${channelFilter === ch ? 'notif-filter-pill--active' : ''}`}
                  onClick={() => setChannelFilter(ch)}
                >
                  {ch.toUpperCase()}
                </button>
              ))}
            </div>

            {/* History Table */}
            {filteredNotifications.length === 0 ? (
              <div className="notif-empty-state">
                <span>📭</span>
                <p>No dispatches match the selected filter.</p>
              </div>
            ) : (
              <div className="notif-table-wrap">
                <table className="notif-table">
                  <thead>
                    <tr>
                      <th>Ref ID</th>
                      <th>Time</th>
                      <th>Location / Geofence</th>
                      <th>Score (Rt)</th>
                      <th>Channels</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotifications.map((notif) => (
                      <tr key={notif.id}>
                        <td className="notif-id-cell">{notif.id}</td>
                        <td className="notif-time-cell">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td>
                          <strong>{notif.node_location}</strong>
                          {notif.sub_zone && (
                            <div className="notif-subzone-text">📍 {notif.sub_zone}</div>
                          )}
                        </td>
                        <td>
                          <span
                            className="notif-score-badge"
                            style={{
                              color: notif.risk_score >= 85 ? 'var(--red)' : notif.risk_score >= 70 ? 'var(--orange)' : 'var(--amber)'
                            }}
                          >
                            Rt: {notif.risk_score} ({notif.severity})
                          </span>
                        </td>
                        <td>
                          <div className="notif-channel-tags">
                            {notif.channels?.map((c) => (
                              <span key={c} className={`notif-tag notif-tag--${c}`}>{c.toUpperCase()}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className="notif-status-pill">
                            ✓ {notif.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
