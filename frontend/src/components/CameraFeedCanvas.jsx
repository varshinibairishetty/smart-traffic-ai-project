// src/components/CameraFeedCanvas.jsx
//
// High-performance canvas-based CCTV camera stream renderer.
// Simulates live video frame feed with:
//   • Dynamic vehicle detection bounding boxes (moving along simulated lanes)
//   • Real-time timestamp with millisecond counter
//   • Camera HUD telemetry: Lens, FPS counter, Resolution, Location
//   • Live Risk & Congestion meter overlay
//   • Night-vision / CCTV scanline filter and radar sweep effect

import { useEffect, useRef, useState } from 'react'

const CLASS_COLORS = {
  car:        '#22c55e', // Green
  motorcycle: '#06b6d4', // Cyan
  bus:        '#f59e0b', // Amber
  truck:      '#ef4444', // Red
}

export default function CameraFeedCanvas({
  camera,
  isFocused = false,
  onToggleFocus = null
}) {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const [fps, setFps] = useState(29.9)

  const riskScore = camera?.current_risk?.score || 40
  const isHighRisk = riskScore >= 70

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Initial vehicle entities for this camera feed
    const vehicles = [
      { id: 1, class: 'car', x: 80, y: 140, w: 60, h: 40, speed: 1.2, conf: 0.94 },
      { id: 2, class: 'car', x: 220, y: 170, w: 65, h: 42, speed: 0.9, conf: 0.91 },
      { id: 3, class: 'bus', x: 380, y: 130, w: 90, h: 55, speed: 0.6, conf: 0.88 },
      { id: 4, class: 'motorcycle', x: 160, y: 220, w: 32, h: 26, speed: 1.8, conf: 0.86 },
      { id: 5, class: 'truck', x: 490, y: 180, w: 95, h: 58, speed: 0.5, conf: 0.92 }
    ]

    let lastTime = performance.now()
    let frameCount = 0
    let radarAngle = 0

    const render = (time) => {
      // Calculate FPS periodically
      frameCount++
      if (time - lastTime >= 1000) {
        setFps((frameCount * 1000 / (time - lastTime)).toFixed(1))
        frameCount = 0
        lastTime = time
      }

      const w = canvas.width
      const h = canvas.height

      // 1. Dark CCTV tarmac backdrop
      ctx.fillStyle = '#080c1d'
      ctx.fillRect(0, 0, w, h)

      // 2. Road geometry & Lane markings
      ctx.strokeStyle = '#1e2640'
      ctx.lineWidth = 1.5
      // Horizon line
      ctx.beginPath()
      ctx.moveTo(0, h * 0.35)
      ctx.lineTo(w, h * 0.35)
      ctx.stroke()

      // Perspective road lanes
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'
      ctx.lineWidth = 2
      ctx.setLineDash([12, 10])

      ctx.beginPath()
      ctx.moveTo(w * 0.2, h * 0.35)
      ctx.lineTo(w * 0.05, h)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(w * 0.45, h * 0.35)
      ctx.lineTo(w * 0.35, h)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(w * 0.7, h * 0.35)
      ctx.lineTo(w * 0.65, h)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(w * 0.88, h * 0.35)
      ctx.lineTo(w * 0.95, h)
      ctx.stroke()
      ctx.setLineDash([])

      // Virtual Counting Tripwire line (Stage 3 Flow Line)
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.moveTo(0, h * 0.55)
      ctx.lineTo(w, h * 0.55)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(234, 179, 8, 0.8)'
      ctx.font = 'bold 8px monospace'
      ctx.fillText('⚡ TRIPWIRE COUNTING LINE', 14, h * 0.55 - 4)

      // 3. Move and draw vehicle bounding boxes
      vehicles.forEach(v => {
        // Slow down if high risk / congested
        const speedMultiplier = isHighRisk ? 0.3 : 1.0
        v.x += v.speed * speedMultiplier
        if (v.x > w + 20) {
          v.x = -100
        }

        const color = CLASS_COLORS[v.class] || '#22c55e'

        // Bounding box border
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(v.x, v.y, v.w, v.h)

        // Semi-transparent box fill
        ctx.fillStyle = color + '22'
        ctx.fillRect(v.x, v.y, v.w, v.h)

        // Corner reticle accents
        ctx.lineWidth = 2
        const cLen = 6
        ctx.beginPath()
        // Top-left
        ctx.moveTo(v.x, v.y + cLen); ctx.lineTo(v.x, v.y); ctx.lineTo(v.x + cLen, v.y)
        // Top-right
        ctx.moveTo(v.x + v.w - cLen, v.y); ctx.lineTo(v.x + v.w, v.y); ctx.lineTo(v.x + v.w, v.y + cLen)
        // Bottom-left
        ctx.moveTo(v.x, v.y + v.h - cLen); ctx.lineTo(v.x, v.y + v.h); ctx.lineTo(v.x + cLen, v.y + v.h)
        // Bottom-right
        ctx.moveTo(v.x + v.w - cLen, v.y + v.h); ctx.lineTo(v.x + v.w, v.y + v.h); ctx.lineTo(v.x + v.w, v.y + v.h - cLen)
        ctx.stroke()

        // Label tag with Persistent MOT Tracking ID
        ctx.fillStyle = color
        ctx.font = 'bold 9px monospace'
        const tag = `TRK-#${v.id} ${v.class} ${(v.conf * 100).toFixed(0)}%`
        ctx.fillText(tag, v.x, v.y - 4)
      })

      // 4. Subtle CCTV scanline effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
      for (let i = 0; i < h; i += 4) {
        ctx.fillRect(0, i, w, 1)
      }

      // 5. Radar sweep indicator in top right
      radarAngle += 0.04
      const radarX = w - 45
      const radarY = 45
      const radarR = 22

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'
      ctx.beginPath()
      ctx.moveTo(radarX, radarY)
      ctx.lineTo(radarX + Math.cos(radarAngle) * radarR, radarY + Math.sin(radarAngle) * radarR)
      ctx.stroke()

      // 6. Camera HUD Watermarks & Telemetry
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 11px monospace'
      ctx.fillText(`[${camera?.id || 'VID-001'}] ${camera?.name || 'SURVEILLANCE'}`, 14, 22)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px monospace'
      ctx.fillText(`LENS: ${camera?.lens || '4mm f/1.6'} | RES: ${camera?.resolution || '1080p'}`, 14, 38)

      // Flashing REC / LIVE dot
      const blink = Math.floor(time / 500) % 2 === 0
      ctx.fillStyle = blink ? (isHighRisk ? '#ef4444' : '#22c55e') : '#64748b'
      ctx.beginPath()
      ctx.arc(20, h - 20, 5, 0, Math.PI * 2)
      ctx.fill()

      // Timecode
      const now = new Date()
      const timeStr = `${now.toISOString().replace('T', ' ').slice(0, 23)} IST`
      ctx.fillStyle = '#f1f5f9'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`● LIVE ${fps} FPS | ${timeStr}`, 32, h - 17)

      // Risk score banner in HUD
      const riskColor = isHighRisk ? '#ef4444' : riskScore >= 35 ? '#f59e0b' : '#22c55e'
      ctx.fillStyle = riskColor
      ctx.font = 'bold 11px monospace'
      ctx.fillText(`Rt: ${riskScore} [${camera?.current_risk?.category || 'Low'}]`, w - 120, h - 17)

      // High-risk border warning pulse
      if (isHighRisk) {
        ctx.strokeStyle = 'rgba(239, 68, 68, ' + (0.3 + 0.3 * Math.sin(time / 200)) + ')'
        ctx.lineWidth = 4
        ctx.strokeRect(0, 0, w, h)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [camera, isHighRisk, riskScore])

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: '6px', backgroundColor: '#080c1d' }}>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          aspectRatio: '16 / 9'
        }}
      />
      {/* Quick Action Overlay (Expand to Fullscreen inspection) */}
      {onToggleFocus && (
        <button
          onClick={onToggleFocus}
          title={isFocused ? 'Exit focus view' : 'Expand full inspection view'}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(10, 15, 37, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            color: '#f1f5f9',
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)'
          }}
        >
          {isFocused ? '🗗 Minimize' : '⛶ Focus'}
        </button>
      )}
    </div>
  )
}
