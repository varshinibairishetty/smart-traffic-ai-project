// src/hooks/useTrafficSocket.js
//
// Custom React hook — manages the Socket.io connection lifecycle and exposes
// live traffic state to any component that subscribes to it.
//
// Returned state shape:
//   {
//     socketData:      object | null  — latest live_traffic_update payload
//     socketConnected: boolean        — true while the WS connection is open
//     socketError:     string | null  — last transport error message, if any
//     lastEventAt:     string | null  — ISO timestamp of the last received event
//   }
//
// Usage:
//   const { socketData, socketConnected } = useTrafficSocket()

import { useState, useEffect } from 'react'
import socket from '../services/socket.js'

export default function useTrafficSocket() {
  const [socketData,      setSocketData]      = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketError,     setSocketError]     = useState(null)
  const [lastEventAt,     setLastEventAt]     = useState(null)

  useEffect(() => {
    // ── Connect ────────────────────────────────────────────────────────────
    socket.connect()

    // ── Connection events ──────────────────────────────────────────────────
    const onConnect = () => {
      setSocketConnected(true)
      setSocketError(null)
      console.log('[Socket] Connected to backend:', socket.id)
    }

    const onDisconnect = (reason) => {
      setSocketConnected(false)
      console.warn('[Socket] Disconnected:', reason)
    }

    const onConnectError = (err) => {
      setSocketConnected(false)
      setSocketError(err.message)
      console.warn('[Socket] Connection error:', err.message)
    }

    // ── Live traffic event ─────────────────────────────────────────────────
    // Fired by the server every BROADCAST_INTERVAL_MS (default 5 s) and
    // immediately on each 'push_detection_frame' received from Python.
    const onLiveTrafficUpdate = (payload) => {
      setSocketData(payload)
      setLastEventAt(new Date().toISOString())
      setSocketError(null)
    }

    socket.on('connect',             onConnect)
    socket.on('disconnect',          onDisconnect)
    socket.on('connect_error',       onConnectError)
    socket.on('live_traffic_update', onLiveTrafficUpdate)

    // ── Cleanup — remove listeners and disconnect when the hook unmounts ──
    return () => {
      socket.off('connect',             onConnect)
      socket.off('disconnect',          onDisconnect)
      socket.off('connect_error',       onConnectError)
      socket.off('live_traffic_update', onLiveTrafficUpdate)
      socket.disconnect()
    }
  }, []) // run once per mount

  return { socketData, socketConnected, socketError, lastEventAt }
}
