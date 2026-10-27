// src/hooks/useRiskAlert.js
//
// React hook for monitoring real-time Socket.io updates for critical/high accident risk (Rt > 70).
// Triggers an emergency visual alert state and sounds an optional Web Audio beep.

import { useState, useEffect, useRef } from 'react'
import socket from '../services/socket.js'
import { playAlertBeep, isSoundMuted, setSoundMuted } from '../utils/alertSound.js'

export function useRiskAlert() {
  const [alert, setAlert] = useState(null)
  const [muted, setMuted] = useState(isSoundMuted())
  const lastAlertTimeRef = useRef(0)

  useEffect(() => {
    socket.connect()

    const onLiveUpdate = (payload) => {
      if (!payload || !payload.risk) return

      const score = payload.risk.score || 0
      const category = payload.risk.category || 'Low'

      // Check threshold: Rt > 70 (High or Critical Risk)
      if (score > 70) {
        // Find highest risk zone
        const zones = payload.zones || []
        const topZone = zones.length > 0
          ? zones.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), zones[0])
          : null

        const nodeName = topZone ? topZone.name : 'Corridor Hotspot'
        const subZone = topZone?.primary_arterial || topZone?.sub_zones?.[0] || null
        const now = Date.now()

        // Sound alert throttled to at most once per 6 seconds
        if (now - lastAlertTimeRef.current > 6000) {
          playAlertBeep()
          lastAlertTimeRef.current = now
        }

        setAlert({
          score,
          category,
          node: nodeName,
          sub_zone: subZone,
          vehicles: payload.vehicle_count || 0,
          timestamp: new Date().toLocaleTimeString(),
          details: payload.risk.details || {}
        })
      } else {
        // Automatically dismiss if risk drops below 70
        setAlert(null)
      }
    }

    socket.on('live_traffic_update', onLiveUpdate)

    return () => {
      socket.off('live_traffic_update', onLiveUpdate)
    }
  }, [])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setSoundMuted(next)
    if (!next) {
      // Test chirp when unmuting
      playAlertBeep()
    }
  }

  const dismissAlert = () => {
    setAlert(null)
  }

  return {
    alert,
    isMuted: muted,
    toggleMute,
    dismissAlert
  }
}
