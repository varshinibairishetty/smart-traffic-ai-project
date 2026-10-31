// src/components/VideoSelector.jsx
//
// 100% Dynamic Location & Video Selector Dropdown Component
// Zero hardcoded presets or static arrays.
// Queries the backend for the exact .mp4 video files physically located in `videos/`.
// Populates the "Select Intersection / Camera Feed" dropdown dynamically, supports
// direct .mp4 file uploads with optional location and recording timestamp tags, and triggers
// live YOLOv8 analysis for the chosen feed.

import React, { useState, useEffect, useRef } from 'react'
import { fetchSampleVideos } from '../services/api.js'

export default function VideoSelector({
  selectedVideoId = null,
  onSelectVideo = () => {},
  onUploadVideo = null,
  isProcessing = false,
  statusMessage = null
}) {
  const [videoList, setVideoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMetadataTags, setShowMetadataTags] = useState(false)
  const [tagLocation, setTagLocation] = useState('')
  const [tagTimestamp, setTagTimestamp] = useState('')
  const fileInputRef = useRef(null)

  const reloadVideos = () => {
    fetchSampleVideos()
      .then(res => {
        if (res && res.videos && Array.isArray(res.videos)) {
          setVideoList(res.videos)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    let mounted = true
    setLoading(true)

    fetchSampleVideos()
      .then(res => {
        if (!mounted) return
        if (res && res.videos && Array.isArray(res.videos)) {
          setVideoList(res.videos)
        }
      })
      .catch(() => {
        if (!mounted) return
        setVideoList([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  // Identify current selected video matching filename or ID
  const currentVideo = videoList.find(v =>
    v.id === selectedVideoId ||
    v.filename === selectedVideoId ||
    v.zone_id === selectedVideoId ||
    v.key === selectedVideoId
  ) || videoList[0]

  const handleDropdownChange = (e) => {
    const nextId = e.target.value
    if (nextId) {
      onSelectVideo(nextId)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && onUploadVideo) {
      const metadata = {
        location_id: tagLocation || undefined,
        recorded_at: tagTimestamp || undefined
      }
      onUploadVideo(file, metadata, reloadVideos)
    }
    // reset input so the same file can be re-uploaded if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const feedCount = videoList.length

  return (
    <section
      style={{
        margin: '0.75rem 1.25rem 0.5rem',
        padding: '1rem 1.35rem',
        borderRadius: '12px',
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}
      aria-label="Dynamic Intersection and Camera Feed Selector"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        {/* Left: Dynamic Folder Scan Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(14, 165, 233, 0.5))',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem'
            }}
          >
            📹
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Traffic Video Ingestion (Mode A)
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.12rem 0.55rem',
                  borderRadius: '999px',
                  background: feedCount > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: feedCount > 0 ? '#4ade80' : '#fbbf24',
                  border: feedCount > 0 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  fontWeight: 600
                }}
              >
                ● {feedCount} Feeds Online in <code>videos/</code>
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
              {currentVideo ? (
                <>
                  Inspecting:&nbsp;
                  <strong style={{ color: '#cbd5e1' }}>{currentVideo.shortName || currentVideo.name}</strong>
                  &nbsp;• File:&nbsp;
                  <code style={{ color: '#38bdf8' }}>{currentVideo.filename}</code>
                  &nbsp;• YOLOv8 Vehicle Count:&nbsp;
                  <strong style={{ color: '#34d399' }}>{currentVideo.vehicleCount} veh</strong>
                </>
              ) : (
                'Scanning local videos/ directory for .mp4 files...'
              )}
            </p>
          </div>
        </div>

        {/* Right: Dynamic Dropdown, Trigger Button & Upload Video Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="intersection-selector" style={{ fontSize: '0.825rem', color: '#cbd5e1', fontWeight: 600 }}>
            Feed:
          </label>
          <div style={{ position: 'relative' }}>
            <select
              id="intersection-selector"
              value={currentVideo?.id || currentVideo?.filename || ''}
              onChange={handleDropdownChange}
              disabled={isProcessing || videoList.length === 0}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: 'rgba(30, 41, 59, 0.95)',
                color: '#f8fafc',
                border: '1.5px solid rgba(56, 189, 248, 0.5)',
                borderRadius: '8px',
                padding: '0.5rem 2.4rem 0.5rem 0.95rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                outline: 'none',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                minWidth: '250px'
              }}
            >
              {videoList.map(v => (
                <option key={v.id || v.filename} value={v.id || v.filename} style={{ background: '#0f172a', color: '#f8fafc' }}>
                  {v.name}
                </option>
              ))}
            </select>
            <span
              style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#38bdf8',
                fontSize: '0.75rem'
              }}
            >
              ▼
            </span>
          </div>

          <button
            onClick={() => currentVideo && onSelectVideo(currentVideo.id || currentVideo.filename)}
            disabled={isProcessing || !currentVideo}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.6)',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(14, 165, 233, 0.45))',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.2)'
            }}
          >
            <span>⚡</span> Trigger YOLOv8
          </button>

          {/* Toggle Metadata Tagging Box */}
          <button
            type="button"
            onClick={() => setShowMetadataTags(!showMetadataTags)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: showMetadataTags ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(71, 85, 105, 0.4)',
              background: showMetadataTags ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.6)',
              color: showMetadataTags ? '#38bdf8' : '#94a3b8',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
            title="Optionally tag video with location or timestamp before upload"
          >
            ⚙️ Metadata Tagging {showMetadataTags ? '▲' : '▼'}
          </button>

          {/* Upload Video Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".mp4,.avi,.mov,.mkv"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(168, 85, 247, 0.6)',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(147, 51, 234, 0.35))',
              color: '#c084fc',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)'
            }}
            title="Upload any .mp4 traffic video for genuine YOLOv8 vehicle detection"
          >
            <span>📤</span> Upload .mp4
          </button>
        </div>
      </div>

      {/* Optional Metadata Tagging Drawer */}
      {showMetadataTags && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            flexWrap: 'wrap',
            fontSize: '0.78rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Known Location (Optional):</span>
            <select
              value={tagLocation}
              onChange={(e) => setTagLocation(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem'
              }}
            >
              <option value="">Unknown / Unspecified Road (Default)</option>
              <option value="hitec-city">HITEC City (Cyber Towers Junction)</option>
              <option value="gachibowli">Gachibowli Junction (ORR Interlink)</option>
              <option value="madhapur">Madhapur (Mindspace Circle)</option>
              <option value="kukatpally">Kukatpally (Y-Junction / NH 65)</option>
              <option value="punjagutta">Punjagutta (Central Flyover Hub)</option>
              <option value="secunderabad">Secunderabad (Station Corridor)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Recording Timestamp (Optional):</span>
            <input
              type="datetime-local"
              value={tagTimestamp}
              onChange={(e) => setTagTimestamp(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem'
              }}
            />
          </div>

          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
            * Note: If location or time is unknown, the video is evaluated strictly in isolation without attaching unrelated weather or crash data.
          </span>
        </div>
      )}

      {/* Processing Status Feedback Banner */}
      {statusMessage && (
        <div
          style={{
            padding: '0.5rem 0.95rem',
            borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.14)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            fontSize: '0.8rem',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>{isProcessing ? '⏳' : '✓'}</span>
          <span>{statusMessage}</span>
        </div>
      )}
    </section>
  )
}
