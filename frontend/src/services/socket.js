// src/services/socket.js
//
// Socket.io client singleton with robust auto-reconnection logic and JWT handshake support.
// Automatically recovers from server restarts, network blips, or backend redeployments
// without crashing the React application.

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const initialToken = localStorage.getItem('traffic_ai_token');

const socket = io(SOCKET_URL, {
  autoConnect:          false,      // controlled lifecycle via component mount
  reconnection:         true,       // enable automatic reconnection
  reconnectionAttempts: Infinity,   // retry continuously until backend is back online
  reconnectionDelay:    1000,       // initial wait 1s before retry
  reconnectionDelayMax: 5000,       // maximum delay backoff capped at 5s
  randomizationFactor:  0.3,        // jitter to prevent thundering herd
  timeout:              10000,      // connection timeout 10s
  transports:           ['websocket', 'polling'], // prefer WebSocket, fallback to polling
  auth: {
    token: initialToken || null
  }
});

/**
 * Updates socket authentication payload dynamically upon login or logout.
 */
export function updateSocketAuth(token) {
  socket.auth = { token: token || null };
  if (socket.connected) {
    socket.disconnect().connect();
  }
}

// Attach connection lifecycle logging and event listeners
socket.on('connect', () => {
  console.log(`[Socket.io] Connected successfully to ${SOCKET_URL} (ID: ${socket.id})`);
});

socket.on('disconnect', (reason) => {
  console.warn(`[Socket.io] Disconnected: ${reason}. Auto-reconnection active...`);
  if (reason === 'io server disconnect') {
    // Server disconnected socket explicitly, force manual reconnect
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  console.debug(`[Socket.io] Connect error: ${error.message} (will auto-retry)`);
});

socket.on('auth_error', (err) => {
  console.warn(`[Socket.io] Auth error from server:`, err);
});

// Manager-level reconnection events
if (socket.io) {
  socket.io.on('reconnect_attempt', (attempt) => {
    // Always refresh token on reconnect
    const currentToken = localStorage.getItem('traffic_ai_token');
    socket.auth = { token: currentToken || null };
    console.debug(`[Socket.io] Reconnect attempt #${attempt}...`);
  });

  socket.io.on('reconnect', (attempt) => {
    console.log(`[Socket.io] Reconnected successfully after ${attempt} attempts!`);
  });

  socket.io.on('reconnect_error', (err) => {
    console.debug(`[Socket.io] Reconnect attempt failed: ${err.message}`);
  });
}

export default socket;
