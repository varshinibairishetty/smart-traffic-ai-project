// backend/utils/enrichDetectionOutput.js
// Reads detection_output.json, applies Multi-Object Tracking (IoU + Centroid) and
// Stage 4 Traffic Density analysis, and writes the enriched output back.

const fs = require('fs');
const path = require('path');
const { analyzeDensity } = require('./trafficDensityEngine');

const filePath = path.resolve(__dirname, '../../ai-service/detection_output.json');

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const frames = rawData.frames || [];

// Simple IoU calculator
function computeIoU(b1, b2) {
  const xA = Math.max(b1.x1, b2.x1);
  const yA = Math.max(b1.y1, b2.y1);
  const xB = Math.min(b1.x2, b2.x2);
  const yB = Math.min(b1.y2, b2.y2);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  const a1 = (b1.x2 - b1.x1) * (b1.y2 - b1.y1);
  const a2 = (b2.x2 - b2.x1) * (b2.y2 - b2.y1);
  const union = a1 + a2 - interArea;

  return union <= 0 ? 0 : interArea / union;
}

let nextTrackId = 1;
const activeTracks = new Map(); // id -> { id, bbox, centroid, direction, hits, missed, crossed }
const tripwireY = 400; // ~55% of 720p

let totalLineCrossings = 0;
let lineInbound = 0;
let lineOutbound = 0;

const enrichedFrames = frames.map((f, fIdx) => {
  const vehicles = f.vehicles || [];
  const matchedVehicles = [];
  const assignedTracks = new Set();
  const assignedVehicles = new Set();

  // Greedy match
  vehicles.forEach((v, vIdx) => {
    let bestIoU = 0.25;
    let bestTrackId = null;

    activeTracks.forEach((track, tId) => {
      if (assignedTracks.has(tId)) return;
      const iou = computeIoU(v.bbox, track.bbox);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestTrackId = tId;
      }
    });

    if (bestTrackId !== null) {
      assignedTracks.add(bestTrackId);
      assignedVehicles.add(vIdx);

      const track = activeTracks.get(bestTrackId);
      const cx = Math.round((v.bbox.x1 + v.bbox.x2) / 2);
      const cy = Math.round((v.bbox.y1 + v.bbox.y2) / 2);
      const prevY = track.centroid.y;

      let dir = track.direction;
      if (cy - prevY > 2) dir = 'inbound';
      else if (prevY - cy > 2) dir = 'outbound';

      // Tripwire crossing
      let crossed = track.crossed;
      if (!crossed) {
        if (prevY < tripwireY && cy >= tripwireY) {
          crossed = true;
          totalLineCrossings++;
          lineInbound++;
        } else if (prevY > tripwireY && cy <= tripwireY) {
          crossed = true;
          totalLineCrossings++;
          lineOutbound++;
        }
      }

      track.bbox = v.bbox;
      track.centroid = { x: cx, y: cy };
      track.direction = dir;
      track.crossed = crossed;
      track.missed = 0;
      track.hits++;

      matchedVehicles.push({
        ...v,
        track_id: bestTrackId,
        direction: dir,
        centroid: { x: cx, y: cy },
        crossed_tripwire: crossed
      });
    }
  });

  // New tracks
  vehicles.forEach((v, vIdx) => {
    if (!assignedVehicles.has(vIdx)) {
      const tId = nextTrackId++;
      const cx = Math.round((v.bbox.x1 + v.bbox.x2) / 2);
      const cy = Math.round((v.bbox.y1 + v.bbox.y2) / 2);
      const crossed = cy >= tripwireY;
      if (crossed) {
        totalLineCrossings++;
        lineInbound++;
      }

      activeTracks.set(tId, {
        id: tId,
        bbox: v.bbox,
        centroid: { x: cx, y: cy },
        direction: 'inbound',
        hits: 1,
        missed: 0,
        crossed
      });

      matchedVehicles.push({
        ...v,
        track_id: tId,
        direction: 'inbound',
        centroid: { x: cx, y: cy },
        crossed_tripwire: crossed
      });
    }
  });

  // Increment missed for unmatched
  activeTracks.forEach((track, tId) => {
    if (!assignedTracks.has(tId)) {
      track.missed++;
      if (track.missed > 4) activeTracks.delete(tId);
    }
  });

  const durationSec = f.timestamp_sec || (fIdx * 0.2);
  const density = analyzeDensity({
    vehicleCount: matchedVehicles.length,
    kSat: 25,
    uniqueVehicles: nextTrackId - 1,
    lineCrossings: totalLineCrossings,
    durationSec
  });

  return {
    ...f,
    vehicle_count: matchedVehicles.length,
    vehicles: matchedVehicles,
    active_tracks_count: activeTracks.size,
    unique_vehicles_so_far: nextTrackId - 1,
    total_line_crossings: totalLineCrossings,
    density_pct: density.density_pct,
    congestion_status: density.congestion_status,
    level_of_service: density.level_of_service
  };
});

const latestFrame = enrichedFrames[enrichedFrames.length - 1];
const updatedData = {
  ...rawData,
  summary: {
    ...rawData.summary,
    total_unique_vehicles_tracked: nextTrackId - 1,
    total_line_crossings: totalLineCrossings,
    line_crossing_inbound: lineInbound,
    line_crossing_outbound: lineOutbound,
    corridor_density_pct: latestFrame ? latestFrame.density_pct : 48.0,
    congestion_status: latestFrame ? latestFrame.congestion_status : 'Moderate',
    level_of_service: latestFrame ? latestFrame.level_of_service : 'C/D',
  },
  frames: enrichedFrames
};

fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
console.log(`Successfully enriched ${filePath} with ${nextTrackId - 1} unique tracks and ${totalLineCrossings} line crossings.`);
