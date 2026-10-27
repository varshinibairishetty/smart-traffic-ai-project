// src/components/SimulationPanel.jsx
//
// Floating Simulation Control Panel for the Smart Traffic AI dashboard.
// Provides persistent, one-click controls across all pages to trigger simulation scenarios.
// Enforces Role-Based Access Control (RBAC): Admin permissions required to trigger scenarios.

import { useState, useEffect, useRef } from 'react';
import socket from '../services/socket.js';
import { triggerScenario } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

const SCENARIOS = [
  {
    id: 'normal',
    label: 'Reset to Normal Flow',
    shortLabel: 'Normal Flow',
    icon: '🟢',
    scoreTag: 'Rt ~15',
    color: 'var(--green)',
    desc: 'Off-peak free-flow traffic, low risk, all green map nodes'
  },
  {
    id: 'congestion',
    label: 'Trigger HITEC City Congestion',
    shortLabel: 'HITEC Congestion',
    icon: '🔴',
    scoreTag: 'Rt ~92',
    color: 'var(--red)',
    desc: 'Severe bottleneck in HITEC City corridor, critical alert, red map nodes'
  },
  {
    id: 'incident',
    label: 'Simulate Incident Spike',
    shortLabel: 'Incident Spike',
    icon: '⚠️',
    scoreTag: 'Rt ~72',
    color: 'var(--amber)',
    desc: 'Lane blockage & collision incident, elevated advisory, incident log'
  }
];

export default function SimulationPanel() {
  const { user, isAdmin, demoLogin } = useAuth();
  const [activeScenario, setActiveScenario] = useState('normal');
  const [activeTitle, setActiveTitle] = useState('Normal Flow');
  const [riskScore, setRiskScore] = useState(15);
  const [minimized, setMinimized] = useState(false);
  const [statusToast, setStatusToast] = useState(null);
  const [isTouring, setIsTouring] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const tourTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Show a temporary feedback toast on trigger
  const showToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setStatusToast(message);
    toastTimerRef.current = setTimeout(() => {
      setStatusToast(null);
    }, 4000);
  };

  // Execute scenario switch via both WebSocket and REST for maximum reliability
  const handleSelectScenario = async (scenarioId) => {
    if (!isAdmin) {
      showToast('🔒 Access Denied: Admin role required to trigger simulation scenarios.');
      return;
    }

    try {
      // 1. Emit over WebSocket for instant sub-millisecond push
      if (socket.connected) {
        socket.emit('trigger_scenario', scenarioId);
      }

      // 2. Also invoke backend REST endpoint as fallback
      await triggerScenario(scenarioId);
      
      const target = SCENARIOS.find(s => s.id === scenarioId);
      const label = target ? target.label : scenarioId;
      showToast(`⚡ Activated: "${label}"`);
      setActiveScenario(scenarioId === 'reset' ? null : scenarioId);
    } catch (err) {
      console.warn('Simulation trigger error:', err.message);
      showToast(`⚠️ Error: ${err.message}`);
    }
  };

  // Automated Tour: cycles through Normal -> Congestion -> Incident -> Normal
  const toggleTour = () => {
    if (!isAdmin) {
      showToast('🔒 Access Denied: Admin role required to run Presentation Tour.');
      return;
    }

    if (isTouring) {
      stopTour();
      return;
    }
    setIsTouring(true);
    const sequence = ['normal', 'congestion', 'incident', 'normal'];
    let step = 0;
    setTourStep(1);
    handleSelectScenario(sequence[0]);

    tourTimerRef.current = setInterval(() => {
      step += 1;
      if (step >= sequence.length) {
        stopTour();
        return;
      }
      setTourStep(step + 1);
      handleSelectScenario(sequence[step]);
    }, 7000);
  };

  const stopTour = () => {
    if (tourTimerRef.current) clearInterval(tourTimerRef.current);
    tourTimerRef.current = null;
    setIsTouring(false);
    setTourStep(0);
  };

  // Listen to WebSocket broadcasts to stay synchronized with backend state
  useEffect(() => {
    socket.connect();

    const onTrafficUpdate = (payload) => {
      if (!payload) return;
      if (payload.is_scenario) {
        setActiveScenario(payload.scenario_id);
        setActiveTitle(payload.scenario_title || payload.scenario_code);
      } else {
        setActiveScenario('live');
        setActiveTitle('Live Camera Stream');
      }
      if (payload.risk?.score !== undefined) {
        setRiskScore(payload.risk.score);
      }
    };

    const onAuthError = (err) => {
      showToast(`⚠️ ${err.message || 'Permission denied'}`);
    };

    socket.on('live_traffic_update', onTrafficUpdate);
    socket.on('auth_error', onAuthError);

    return () => {
      socket.off('live_traffic_update', onTrafficUpdate);
      socket.off('auth_error', onAuthError);
      if (tourTimerRef.current) clearInterval(tourTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <aside 
      className={`sim-panel-dock ${minimized ? 'sim-panel-dock--minimized' : ''}`}
      aria-label="Simulation Control Panel"
    >
      {/* Toast Feedback Notification */}
      {statusToast && (
        <div className="sim-toast" role="status" aria-live="polite">
          <span>{statusToast}</span>
        </div>
      )}

      {/* Main floating control container */}
      <div className="sim-panel-card">
        {/* Header / Dock Toggle Bar */}
        <div className="sim-panel-header">
          <div className="sim-panel-title-wrap">
            <span className="sim-panel-icon" aria-hidden="true">🎮</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="sim-panel-title">Simulation Control Panel</span>
                {isAdmin ? (
                  <span className="rbac-micro-pill rbac-micro-pill--admin">ADMIN</span>
                ) : (
                  <span className="rbac-micro-pill rbac-micro-pill--locked">LOCKED</span>
                )}
              </div>
              <span className="sim-panel-subtitle">
                Active: <strong style={{ color: riskScore >= 67 ? 'var(--red)' : riskScore >= 35 ? 'var(--amber)' : 'var(--green)' }}>
                  {activeTitle} (Rt: {riskScore})
                </strong>
              </span>
            </div>
          </div>

          <div className="sim-panel-header-actions">
            <button
              className="sim-panel-collapse-btn"
              onClick={() => setMinimized(!minimized)}
              title={minimized ? 'Expand Simulation Panel' : 'Minimize Panel'}
              aria-expanded={!minimized}
            >
              {minimized ? '▲ Expand' : '▼ Minimize'}
            </button>
          </div>
        </div>

        {/* Action Buttons (Visible when not minimized) */}
        {!minimized && (
          <div className="sim-panel-body">
            {/* RBAC Operator Warning Banner if not Admin */}
            {!isAdmin && (
              <div className="sim-rbac-locked-notice">
                <span className="sim-rbac-locked-notice__icon">🔒</span>
                <div className="sim-rbac-locked-notice__text">
                  <strong>Admin Role Required:</strong>
                  <span> Simulation injection and incident triggering are restricted.</span>
                </div>
                <button
                  type="button"
                  className="sim-rbac-switch-btn"
                  onClick={() => demoLogin('admin')}
                  title="Switch session to Administrator account"
                >
                  Switch to Admin 👑
                </button>
              </div>
            )}

            <div className="sim-panel-buttons-grid">
              {SCENARIOS.map((sc) => {
                const isSelected = activeScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    className={`sim-btn sim-btn--${sc.id} ${isSelected ? 'sim-btn--active' : ''} ${!isAdmin ? 'sim-btn--disabled' : ''}`}
                    onClick={() => { stopTour(); handleSelectScenario(sc.id); }}
                    title={!isAdmin ? 'Admin role required to trigger this scenario' : sc.desc}
                    disabled={!isAdmin}
                  >
                    <span className="sim-btn__icon" aria-hidden="true">{sc.icon}</span>
                    <span className="sim-btn__text">
                      <span className="sim-btn__label">{sc.label}</span>
                      <span className="sim-btn__tag">{sc.scoreTag}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Utility actions: Auto-Tour & Live Reset */}
            <div className="sim-panel-footer">
              <button
                className={`sim-btn-util sim-btn-util--tour ${isTouring ? 'sim-btn-util--touring' : ''} ${!isAdmin ? 'sim-btn-util--disabled' : ''}`}
                onClick={toggleTour}
                disabled={!isAdmin}
                title={!isAdmin ? 'Admin role required for auto tour' : 'Automatically sequence all scenarios for presentation demo'}
              >
                {isTouring ? `⏹ Stop Auto Tour (${tourStep}/4)` : '▶ Auto Tour (Presentation Mode)'}
              </button>

              <button
                className={`sim-btn-util sim-btn-util--reset ${!isAdmin ? 'sim-btn-util--disabled' : ''}`}
                onClick={() => { stopTour(); handleSelectScenario('reset'); }}
                disabled={!isAdmin}
                title="Restore live camera/video detection stream"
              >
                ↺ Live Video
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
