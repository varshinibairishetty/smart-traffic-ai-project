// src/components/LocationSelector.jsx
//
// Neo-Glass Location Selector for Hyderabad Smart Traffic Management System.
// Enables selecting between configured Hyderabad arterial junctions and corridors.
// Displays live coordinates, corridor descriptions, freshness indicators, and manual refresh triggers.

import React from 'react'

export default function LocationSelector({
  locations = [],
  selectedLocationId = null,
  onSelectLocation = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  dataFreshness = 'live',
  lastUpdated = null
}) {
  const selectedLocation = locations.find(l => l.id === selectedLocationId || l.location_id === selectedLocationId) || locations[0]

  // Freshness badge config
  const getFreshnessBadge = (freshness) => {
    switch (freshness) {
      case 'live':
        return { label: '● LIVE STREAM', bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.4)' }
      case 'cached':
        return { label: '⚡ CACHED (TTL < 5M)', bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' }
      case 'traffic_unconfigured':
      case 'unconfigured':
        return { label: 'ℹ WEATHER LIVE · TOMTOM KEY PENDING', bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' }
      default:
        return { label: '⚠️ OFFLINE FALLBACK', bg: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: 'rgba(244, 63, 94, 0.4)' }
    }
  }

  const freshnessStyle = getFreshnessBadge(dataFreshness)

  return (
    <section
      className="card location-selector-card"
      style={{
        margin: '0.75rem 1.25rem 0.25rem',
        padding: '0.85rem 1.25rem',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}
      aria-label="Hyderabad Location Management"
    >
      {/* Top Row: Title, Selected Details & Action Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.35))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}
          >
            📍
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {selectedLocation?.name || 'Hyderabad Traffic Monitor'}
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: freshnessStyle.bg,
                  color: freshnessStyle.color,
                  border: `1px solid ${freshnessStyle.border}`,
                  fontWeight: 600,
                  letterSpacing: '0.04em'
                }}
              >
                {freshnessStyle.label}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>
              Corridor: <span style={{ color: '#e2e8f0' }}>{selectedLocation?.corridor || 'Hyderabad Metropolitan Area'}</span>
              {selectedLocation?.coordinates && (
                <> • <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
                  {selectedLocation.coordinates.latitude?.toFixed(4)}° N, {selectedLocation.coordinates.longitude?.toFixed(4)}° E
                </span></>
              )}
              {selectedLocation?.speed_limit_kmh && (
                <> • Speed Limit: <span style={{ color: '#38bdf8' }}>{selectedLocation.speed_limit_kmh} km/h</span></>
              )}
            </p>
          </div>
        </div>

        {/* Right Action: Refresh Telemetry Button and Last Updated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Updated {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: isRefreshing ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Fetch latest traffic flow and weather from external APIs"
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s linear' }}>
              🔄
            </span>
            <span>{isRefreshing ? 'Refreshing APIs...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Location Quick-Select Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
          scrollbarWidth: 'none'
        }}
      >
        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          Junctions:
        </span>
        {locations.map((loc) => {
          const locId = loc.id || loc.location_id
          const isSelected = locId === (selectedLocation?.id || selectedLocation?.location_id)
          return (
            <button
              key={locId}
              onClick={() => onSelectLocation(locId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.35))'
                  : 'rgba(30, 41, 59, 0.6)',
                border: isSelected
                  ? '1px solid rgba(56, 189, 248, 0.7)'
                  : '1px solid rgba(71, 85, 105, 0.35)',
                color: isSelected ? '#f8fafc' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{loc.category?.includes('Overpass') || loc.category?.includes('Flyover') ? '🌉' : '🚦'}</span>
              <span>{loc.short_name || loc.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
