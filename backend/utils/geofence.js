// backend/utils/geofence.js
//
// Geo-Spatial Proximity & Geofencing Alert Engine for Hyderabad Traffic Corridors.
// Maps geographical bounding boxes and radius perimeters for key nodes:
//   • HITEC City
//   • Gachibowli
//   • Madhapur
//   • Jubilee Hills
//   • Kondapur
//   • Banjara Hills
//
// Provides point-in-bounding-box and Haversine great-circle distance evaluation.

const EARTH_RADIUS_METERS = 6371000;

const HYDERABAD_GEOFENCES = [
  {
    id: 'hitec-city',
    name: 'HITEC City',
    center: { lat: 17.4435, lon: 78.3772 },
    radius_meters: 1200,
    bbox: {
      minLat: 17.4350,
      maxLat: 17.4550,
      minLon: 78.3680,
      maxLon: 78.3880
    },
    polygon: [
      [17.4350, 78.3680],
      [17.4550, 78.3680],
      [17.4550, 78.3880],
      [17.4350, 78.3880]
    ],
    sub_zones: [
      'Cyber Towers Junction',
      'Mindspace Roundabout',
      'HITEC City Metro Pillar 1008',
      'Cyber Gateway Corridor'
    ],
    primary_arterial: 'Cyber Towers Junction',
    corridor_type: 'Primary Tech Arterial',
    speed_limit_kmh: 50
  },
  {
    id: 'gachibowli',
    name: 'Gachibowli',
    center: { lat: 17.4401, lon: 78.3489 },
    radius_meters: 1400,
    bbox: {
      minLat: 17.4300,
      maxLat: 17.4520,
      minLon: 78.3380,
      maxLon: 78.3620
    },
    polygon: [
      [17.4300, 78.3380],
      [17.4520, 78.3380],
      [17.4520, 78.3620],
      [17.4300, 78.3620]
    ],
    sub_zones: [
      'Bio-Diversity Flyover',
      'IIIT Junction',
      'ORR Outer Junction Ramp',
      'Gachibowli Stadium Circle'
    ],
    primary_arterial: 'Bio-Diversity Flyover',
    corridor_type: 'Expressway Gateway',
    speed_limit_kmh: 60
  },
  {
    id: 'madhapur',
    name: 'Madhapur',
    center: { lat: 17.4481, lon: 78.3915 },
    radius_meters: 1100,
    bbox: {
      minLat: 17.4400,
      maxLat: 17.4600,
      minLon: 78.3820,
      maxLon: 78.4020
    },
    polygon: [
      [17.4400, 78.3820],
      [17.4600, 78.3820],
      [17.4600, 78.4020],
      [17.4400, 78.4020]
    ],
    sub_zones: [
      'Metro Pillar 1042',
      'Ayyappa Society Main Road',
      '100ft Road Link',
      'Inorbit Mall Approach'
    ],
    primary_arterial: 'Metro Pillar 1042',
    corridor_type: 'Dense Commercial Corridor',
    speed_limit_kmh: 40
  },
  {
    id: 'jubilee-hills',
    name: 'Jubilee Hills',
    center: { lat: 17.4326, lon: 78.4072 },
    radius_meters: 1300,
    bbox: {
      minLat: 17.4220,
      maxLat: 17.4440,
      minLon: 78.3980,
      maxLon: 78.4200
    },
    polygon: [
      [17.4220, 78.3980],
      [17.4440, 78.3980],
      [17.4440, 78.4200],
      [17.4220, 78.4200]
    ],
    sub_zones: [
      'Checkpost Circle Road 36',
      'Peddamma Temple Junction',
      'Road No 45 Cable Bridge Link',
      'Apollo Hospital Junction'
    ],
    primary_arterial: 'Checkpost Circle Road 36',
    corridor_type: 'Urban Gateway Arterial',
    speed_limit_kmh: 50
  },
  {
    id: 'kondapur',
    name: 'Kondapur',
    center: { lat: 17.4600, lon: 78.3542 },
    radius_meters: 1200,
    bbox: {
      minLat: 17.4500,
      maxLat: 17.4720,
      minLon: 78.3450,
      maxLon: 78.3680
    },
    polygon: [
      [17.4500, 78.3450],
      [17.4720, 78.3450],
      [17.4720, 78.3680],
      [17.4500, 78.3680]
    ],
    sub_zones: [
      'RTA Crossroads',
      'Botanical Garden Circle',
      'Hafeezpet Link Road',
      'Kothaguda Junction'
    ],
    primary_arterial: 'RTA Crossroads',
    corridor_type: 'Sub-Arterial Corridor',
    speed_limit_kmh: 45
  },
  {
    id: 'banjara-hills',
    name: 'Banjara Hills',
    center: { lat: 17.4138, lon: 78.4494 },
    radius_meters: 1100,
    bbox: {
      minLat: 17.4040,
      maxLat: 17.4250,
      minLon: 78.4380,
      maxLon: 78.4620
    },
    polygon: [
      [17.4040, 78.4380],
      [17.4250, 78.4380],
      [17.4250, 78.4620],
      [17.4040, 78.4620]
    ],
    sub_zones: [
      'Road No 1 Care Hospital Junction',
      'Taj Krishna Circle',
      'Road No 12 Panjagutta Link',
      'Star Hospital Curve'
    ],
    primary_arterial: 'Road No 1 Care Hospital Junction',
    corridor_type: 'Central Urban Link',
    speed_limit_kmh: 45
  }
];

/**
 * Calculates great-circle distance between two GPS coordinates in meters (Haversine formula).
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Checks if a coordinate is strictly inside a rectangular bounding box.
 */
function isPointInBoundingBox(lat, lon, bbox) {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/**
 * Evaluates coordinates against all known Hyderabad geofences.
 * Returns the matching zone, distance to center, inside boundary flag, and assigned sub-zone.
 */
function matchGeofence(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  // 1. Direct bounding box containment check
  for (const fence of HYDERABAD_GEOFENCES) {
    if (isPointInBoundingBox(lat, lon, fence.bbox)) {
      const dist = calculateDistanceMeters(lat, lon, fence.center.lat, fence.center.lon);
      // Select sub-zone based on fractional distance
      const subZoneIdx = Math.abs(Math.floor((lat + lon) * 1000)) % fence.sub_zones.length;
      return {
        matched: true,
        zone_id: fence.id,
        zone_name: fence.name,
        sub_zone: fence.sub_zones[subZoneIdx] || fence.primary_arterial,
        primary_arterial: fence.primary_arterial,
        distance_meters: dist,
        within_radius: dist <= fence.radius_meters,
        coordinates: [lat, lon],
        corridor_type: fence.corridor_type
      };
    }
  }

  // 2. Proximity fallback: find nearest center point
  let nearest = null;
  let minDistance = Infinity;

  for (const fence of HYDERABAD_GEOFENCES) {
    const dist = calculateDistanceMeters(lat, lon, fence.center.lat, fence.center.lon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = fence;
    }
  }

  if (nearest) {
    return {
      matched: false, // Not strictly inside bbox, but nearest node identified
      zone_id: nearest.id,
      zone_name: nearest.name,
      sub_zone: nearest.primary_arterial,
      primary_arterial: nearest.primary_arterial,
      distance_meters: minDistance,
      within_radius: minDistance <= nearest.radius_meters,
      coordinates: [lat, lon],
      corridor_type: nearest.corridor_type
    };
  }

  return null;
}

/**
 * Enriches an incident or detection frame payload with geofencing metadata.
 */
function enrichWithGeofence(payload = {}) {
  // Check if explicit coordinates provided
  let lat = payload.lat !== undefined ? payload.lat : payload.coordinates?.[0];
  let lon = payload.lon !== undefined ? payload.lon : payload.coordinates?.[1];

  // If no coordinates, map from zone_id or zone_name
  if (lat === undefined || lon === undefined) {
    const zoneId = payload.zone_id || (payload.node_location ? payload.node_location.toLowerCase().replace(/\s+/g, '-') : null);
    const matched = HYDERABAD_GEOFENCES.find(g => g.id === zoneId || g.name.toLowerCase() === (payload.node_location || '').toLowerCase());
    if (matched) {
      lat = matched.center.lat;
      lon = matched.center.lon;
    } else {
      // Default to HITEC City
      lat = HYDERABAD_GEOFENCES[0].center.lat;
      lon = HYDERABAD_GEOFENCES[0].center.lon;
    }
  }

  const geofenceResult = matchGeofence(lat, lon);

  return {
    ...payload,
    lat,
    lon,
    coordinates: [lat, lon],
    geofence: geofenceResult,
    sub_zone: payload.sub_zone || geofenceResult?.sub_zone || 'Cyber Towers Junction',
    node_location: payload.node_location || geofenceResult?.zone_name || 'HITEC City'
  };
}

module.exports = {
  HYDERABAD_GEOFENCES,
  calculateDistanceMeters,
  isPointInBoundingBox,
  matchGeofence,
  enrichWithGeofence
};
