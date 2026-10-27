// src/main.jsx
//
// JavaScript entry point for the React application.
// Wraps the entire tree in BrowserRouter for client-side routing,
// then defines the top-level routes.

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import NavBar    from './components/NavBar.jsx'
import App       from './App.jsx'
import LiveMap   from './pages/LiveMap.jsx'
import Incidents from './pages/Incidents.jsx'
import Cameras   from './pages/Cameras.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Persistent navigation bar shown on every page */}
      <NavBar />
      <Routes>
        <Route path="/"          element={<App />}       />
        <Route path="/live-map"  element={<LiveMap />}   />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/cameras"   element={<Cameras />}   />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
