// src/main.jsx
//
// JavaScript entry point for the React application.
// Wraps the entire tree in AuthProvider and BrowserRouter for authentication,
// RBAC session handling, and client-side routing.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import { AuthProvider } from './context/AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import AlertBanner from './components/AlertBanner.jsx';
import SimulationPanel from './components/SimulationPanel.jsx';
import App from './App.jsx';
import LiveMap from './pages/LiveMap.jsx';
import Incidents from './pages/Incidents.jsx';
import Analytics from './pages/Analytics.jsx';
import Cameras from './pages/Cameras.jsx';
import Login from './pages/Login.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        {/* Persistent navigation bar with RBAC badge shown on every page */}
        <NavBar />
        {/* Global emergency alert banner for high-risk events (Rt > 70) */}
        <AlertBanner />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/live-map" element={<LiveMap />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/login" element={<Login />} />
        </Routes>
        {/* Floating Simulation Control Panel accessible across all pages with RBAC checks */}
        <SimulationPanel />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
