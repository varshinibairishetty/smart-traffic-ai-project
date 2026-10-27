// src/data/sampleData.js
//
// ⚠️  DEMO DATA — Nothing here is real.
// This file contains hardcoded sample numbers that make the dashboard look
// realistic during Phase 1 (frontend only). Every value will be replaced by
// live data from the backend API once Phases 2–3 are built.
//
// When the backend is connected, delete this file and fetch from:
//   GET http://localhost:5000/detections/latest
//   GET http://localhost:5000/risk/current

// Banner text shown at the top of every page
export const DEMO_NOTICE =
  'Demo mode — displaying sample data only. No AI service, backend, or database is connected yet.'

// ─── Overall traffic summary ──────────────────────────────────────────────
// This will come from GET /detections/latest in Phase 3+
export const trafficSummary = {
  vehicleCount:     47,       // total vehicles detected in the latest frame
  densityLabel:     'Medium', // human-readable density category
  densityValue:     62,       // density as a percentage 0–100
  congestionStatus: 'Moderate',
  congestionLevel:  2,        // 0=Free, 1=Light, 2=Moderate, 3=Heavy, 4=Standstill
  riskScore:        42,       // accident risk 0–100 (no AI model yet — static sample)
  riskLevel:        'Medium',
  avgConfidence:    0.87,     // average YOLO detection confidence (0.0–1.0)
  activeSegments:   3,        // number of road segments being monitored
  source:           'traffic-sample.mp4',  // video file this would come from
  timestamp:        '2026-10-27T12:00:00', // last update time (simulated)
}

// ─── Vehicle type breakdown ───────────────────────────────────────────────
// Will come from the detections array in the API response
export const vehicleBreakdown = [
  { type: 'Cars',        count: 31, color: '#38bdf8', icon: '🚗' },
  { type: 'Trucks',      count:  8, color: '#818cf8', icon: '🚛' },
  { type: 'Motorcycles', count:  5, color: '#34d399', icon: '🏍️' },
  { type: 'Buses',       count:  3, color: '#fbbf24', icon: '🚌' },
]

// ─── Per-road-segment status ──────────────────────────────────────────────
// Will come from a future GET /segments endpoint
// level: 0=Free, 1=Light, 2=Moderate, 3=Heavy, 4=Standstill
export const roadSegments = [
  { id: 'SEG-A', name: 'Main St — North',   vehicles: 18, status: 'Heavy',    level: 3 },
  { id: 'SEG-B', name: 'Ring Rd — East',    vehicles: 14, status: 'Moderate', level: 2 },
  { id: 'SEG-C', name: 'City Ave — South',  vehicles: 15, status: 'Moderate', level: 2 },
]

// ─── Recent individual detections ─────────────────────────────────────────
// Will come from GET /detections in Phase 3+
// Each row = one vehicle YOLO identified in a video frame
export const recentDetections = [
  { id: 'D-001', timestamp: '12:00:08', vehicleClass: 'Car',        confidence: 0.94, segment: 'SEG-A' },
  { id: 'D-002', timestamp: '12:00:07', vehicleClass: 'Truck',      confidence: 0.89, segment: 'SEG-B' },
  { id: 'D-003', timestamp: '12:00:06', vehicleClass: 'Motorcycle', confidence: 0.82, segment: 'SEG-A' },
  { id: 'D-004', timestamp: '12:00:06', vehicleClass: 'Car',        confidence: 0.91, segment: 'SEG-C' },
  { id: 'D-005', timestamp: '12:00:05', vehicleClass: 'Bus',        confidence: 0.96, segment: 'SEG-B' },
  { id: 'D-006', timestamp: '12:00:05', vehicleClass: 'Car',        confidence: 0.88, segment: 'SEG-C' },
  { id: 'D-007', timestamp: '12:00:04', vehicleClass: 'Car',        confidence: 0.93, segment: 'SEG-A' },
  { id: 'D-008', timestamp: '12:00:03', vehicleClass: 'Truck',      confidence: 0.85, segment: 'SEG-A' },
]
