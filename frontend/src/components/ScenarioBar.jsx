// src/components/ScenarioBar.jsx
//
// Test & Demo Scenario Runner control bar for college viva presentations.
// Allows presenters to trigger real-time traffic scenarios with one click:
//   • Scenario A: Normal Flow (Low Rt - Green)
//   • Scenario B: Moderate Traffic (Medium Rt - Amber)
//   • Scenario C: Sudden Heavy Congestion in HITEC City (Critical Rt - Red)
//   • Scenario D: Collision Incident in Madhapur (High Rt - Red/Orange)
//   • Auto Tour: Sequences through scenarios automatically
//   • Reset: Restores live video detection stream

import { useState, useEffect, useRef } from 'react'
import { triggerScenario } from '../services/api.js'

const SCENARIOS = [
  { id: 'normal',     label: '🟢 Normal Flow',         code: 'A', score: '~15' },
  { id: 'moderate',   label: '🟡 Moderate Commute',     code: 'B', score: '~45' },
  { id: 'congestion', label: '🔴 HITEC Congestion',    code: 'C', score: '~92' },
  { id: 'incident',   label: '⚠️ Road Obstruction',     code: 'D', score: '~72' },
]

export default function ScenarioBar({ activeScenarioId = null, onScenarioTriggered = null }) {
  const [active, setActive] = useState(activeScenarioId)
  const [touring, setTouring] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const tourTimerRef = useRef(null)

  useEffect(() => {
    setActive(activeScenarioId)
  }, [activeScenarioId])

  const handleTrigger = async (id) => {
    try {
      setActive(id === 'reset' ? null : id)
      await triggerScenario(id)
      if (onScenarioTriggered) onScenarioTriggered(id)
    } catch (err) {
      console.warn('Could not trigger demo scenario:', err.message)
    }
  }

  // Automated Viva Tour: sequences through scenarios every 6 seconds
  const startTour = () => {
    if (touring) {
      stopTour()
      return
    }
    setTouring(true)
    const sequence = ['normal', 'moderate', 'congestion', 'incident', 'normal']
    let step = 0
    setTourStep(1)
    handleTrigger(sequence[0])

    tourTimerRef.current = setInterval(() => {
      step += 1
      if (step >= sequence.length) {
        stopTour()
        return
      }
      setTourStep(step + 1)
      handleTrigger(sequence[step])
    }, 6000)
  }

  const stopTour = () => {
    if (tourTimerRef.current) clearInterval(tourTimerRef.current)
    tourTimerRef.current = null
    setTouring(false)
    setTourStep(0)
  }

  useEffect(() => {
    return () => {
      if (tourTimerRef.current) clearInterval(tourTimerRef.current)
    }
  }, [])

  return (
    <div className="scenario-bar" role="region" aria-label="Viva Presentation Scenario Runner">
      <div className="scenario-bar__left">
        <span className="scenario-bar__badge">
          <span className="scenario-bar__pulse" aria-hidden="true">🎯</span>
          <strong>Viva Demo Scenarios:</strong>
        </span>
      </div>

      <div className="scenario-bar__buttons">
        {SCENARIOS.map((sc) => {
          const isSelected = active === sc.id
          return (
            <button
              key={sc.id}
              className={`scenario-btn ${isSelected ? 'scenario-btn--active' : ''}`}
              onClick={() => { stopTour(); handleTrigger(sc.id); }}
              title={`Switch to ${sc.label} (Risk ${sc.score})`}
            >
              <span className="scenario-btn__label">{sc.label}</span>
              <span className="scenario-btn__tag">{sc.score}</span>
            </button>
          )
        })}

        <button
          className={`scenario-btn scenario-btn--tour ${touring ? 'scenario-btn--touring' : ''}`}
          onClick={startTour}
          title="Run automated 5-step presentation tour"
        >
          {touring ? `⏹ Stop Tour (${tourStep}/5)` : '▶ Auto Tour'}
        </button>

        {active && (
          <button
            className="scenario-btn scenario-btn--reset"
            onClick={() => { stopTour(); handleTrigger('reset'); }}
            title="Reset to live camera/video detection feed"
          >
            ↺ Reset
          </button>
        )}
      </div>
    </div>
  )
}
