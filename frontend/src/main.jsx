// src/main.jsx
//
// This is the JavaScript entry point for the React app.
// It finds the <div id="root"> in index.html and mounts the entire
// React component tree inside it.
//
// You almost never need to edit this file.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'     // global styles loaded once here

ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode runs extra checks in development to catch mistakes early.
  // It has no effect on the built (production) version.
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
