// src/components/ComputerVisionLabPanel.jsx
//
// Secondary / Experimental Computer Vision Lab Panel.
// Preserves offline CCTV video file ingestion, OpenCV decoding, and Ultralytics YOLOv8
// vehicle inference without dominating the live API-driven traffic dashboard.

import React, { useState } from 'react'
import VideoSelector from './VideoSelector.jsx'
import ActiveCamerasGrid from './ActiveCamerasGrid.jsx'

export default function ComputerVisionLabPanel({
  camerasList = [],
  focusedCamId = null,
  selectedVideoId = null,
  onSelectVideo = () => {},
  onSelectCamera = () => {},
  isProcessingVideo = false,
  videoStatusMessage = null
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section
      className="card cv-lab-panel"
      style={{
        marginTop: '1.5rem',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}
      aria-label="Computer Vision and Video Lab"
    >
      {/* Collapsible Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: isOpen ? 'rgba(30, 41, 59, 0.5)' : 'transparent',
          borderBottom: isOpen ? '1px solid rgba(148, 163, 184, 0.15)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(139, 92, 246, 0.35))',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem'
            }}
          >
            🔬
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Computer Vision & Video Ingestion Lab (Secondary / Offline Tool)
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  fontWeight: 600
                }}
              >
                {camerasList.length} Offline Feeds
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.1rem 0 0' }}>
              Optional module for analyzing local CCTV .mp4 files with OpenCV and Ultralytics YOLOv8n
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#a855f7', fontWeight: 600 }}>
            {isOpen ? '▲ Collapse Lab' : '▼ Expand Lab'}
          </span>
        </div>
      </div>

      {/* Expanded Lab Body */}
      {isOpen && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              lineHeight: 1.4
            }}
          >
            <strong>Edge CCTV Verification Mode:</strong> The primary Hyderabad platform operates via live traffic and meteorological APIs. This lab tool enables engineers to inspect offline video recordings from local intersection cameras using real-time YOLOv8 bounding-box inference.
          </div>

          <VideoSelector
            selectedVideoId={selectedVideoId}
            onSelectVideo={onSelectVideo}
            isProcessing={isProcessingVideo}
            statusMessage={videoStatusMessage}
          />

          <ActiveCamerasGrid
            cameras={camerasList}
            focusedCamId={focusedCamId}
            onSelectCamera={onSelectCamera}
            isProcessing={isProcessingVideo}
          />
        </div>
      )}
    </section>
  )
}
