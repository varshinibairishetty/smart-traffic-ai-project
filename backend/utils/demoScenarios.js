// backend/utils/demoScenarios.js
//
// Pre-configured test and demonstration scenarios for live presentation / viva.
// Allows presenters to instantly simulate different traffic states:
//   • Scenario A: Normal Flow (Low Rt - Green)
//   • Scenario B: Moderate Traffic (Medium Rt - Amber)
//   • Scenario C: Sudden Heavy Congestion in HITEC City (Critical Rt - Red)
//   • Scenario D: Multi-Vehicle Incident & Obstruction (High Rt - Red)
//
// ⚠️ DEMO / VIVA INDICATOR:
// These scenarios generate synthetic frame metrics to showcase real-time alerts,
// dynamic risk gauge movements, and color-coded Leaflet map marker transitions.

const { calculateRisk, getRiskCategory } = require('./riskCalculator');

const HYDERABAD_ZONES = [
  { id: 'hitec-city',    name: 'HITEC City',    lat: 17.4435, lon: 78.3772, weight: 1.20 },
  { id: 'gachibowli',   name: 'Gachibowli',    lat: 17.4401, lon: 78.3489, weight: 1.10 },
  { id: 'madhapur',     name: 'Madhapur',       lat: 17.4481, lon: 78.3915, weight: 1.00 },
  { id: 'kondapur',     name: 'Kondapur',       lat: 17.4600, lon: 78.3542, weight: 0.90 },
  { id: 'jubilee-hills',name: 'Jubilee Hills',  lat: 17.4326, lon: 78.4072, weight: 0.85 },
  { id: 'banjara-hills',name: 'Banjara Hills',  lat: 17.4138, lon: 78.4494, weight: 0.90 },
];

function riskColor(score) {
  if (score >= 67) return 'red';
  if (score >= 35) return 'amber';
  return 'green';
}

/**
 * Builds a full scenario payload ready for WebSocket broadcast and REST response.
 */
function buildScenarioPayload(scenarioId) {
  const id = (scenarioId || 'normal').toLowerCase();
  const timestamp = new Date().toISOString();

  let scenarioConfig;

  switch (id) {
    case 'normal':
    case 'scenario_a':
      scenarioConfig = {
        id: 'normal',
        code: 'Scenario A',
        title: 'Normal Flow (Morning Off-Peak)',
        description: 'Free-flow traffic conditions across all regional corridors with low conflict risk.',
        vehicleCount: 5,
        source: 'demo_scenario_normal_flow.mp4',
        byClass: { car: 4, motorcycle: 1, truck: 0, bus: 0 },
        vehicles: [
          { vehicle_class: 'car', confidence: 0.94, bbox: { x1: 200, y1: 300, x2: 320, y2: 420 } },
          { vehicle_class: 'car', confidence: 0.91, bbox: { x1: 450, y1: 250, x2: 560, y2: 340 } },
          { vehicle_class: 'car', confidence: 0.88, bbox: { x1: 600, y1: 180, x2: 690, y2: 250 } },
          { vehicle_class: 'car', confidence: 0.86, bbox: { x1: 120, y1: 400, x2: 260, y2: 510 } },
          { vehicle_class: 'motorcycle', confidence: 0.82, bbox: { x1: 380, y1: 350, x2: 420, y2: 410 } },
        ],
        incidentFrames: []
      };
      break;

    case 'moderate':
    case 'scenario_b':
      scenarioConfig = {
        id: 'moderate',
        code: 'Scenario B',
        title: 'Moderate Density (Midday Commute)',
        description: 'Typical midday traffic with steady progression and moderate vehicle accumulation.',
        vehicleCount: 13,
        source: 'demo_scenario_moderate_commute.mp4',
        byClass: { car: 8, motorcycle: 3, truck: 1, bus: 1 },
        vehicles: [
          { vehicle_class: 'car', confidence: 0.92, bbox: { x1: 180, y1: 320, x2: 300, y2: 440 } },
          { vehicle_class: 'car', confidence: 0.89, bbox: { x1: 340, y1: 260, x2: 450, y2: 360 } },
          { vehicle_class: 'car', confidence: 0.87, bbox: { x1: 520, y1: 220, x2: 610, y2: 300 } },
          { vehicle_class: 'car', confidence: 0.85, bbox: { x1: 670, y1: 190, x2: 750, y2: 260 } },
          { vehicle_class: 'car', confidence: 0.84, bbox: { x1: 110, y1: 420, x2: 230, y2: 530 } },
          { vehicle_class: 'car', confidence: 0.82, bbox: { x1: 280, y1: 380, x2: 390, y2: 480 } },
          { vehicle_class: 'car', confidence: 0.81, bbox: { x1: 440, y1: 340, x2: 540, y2: 430 } },
          { vehicle_class: 'car', confidence: 0.79, bbox: { x1: 590, y1: 290, x2: 680, y2: 370 } },
          { vehicle_class: 'motorcycle', confidence: 0.86, bbox: { x1: 240, y1: 280, x2: 280, y2: 340 } },
          { vehicle_class: 'motorcycle', confidence: 0.83, bbox: { x1: 480, y1: 250, x2: 520, y2: 310 } },
          { vehicle_class: 'motorcycle', confidence: 0.78, bbox: { x1: 630, y1: 210, x2: 660, y2: 260 } },
          { vehicle_class: 'truck', confidence: 0.77, bbox: { x1: 360, y1: 160, x2: 490, y2: 290 } },
          { vehicle_class: 'bus', confidence: 0.88, bbox: { x1: 50, y1: 220, x2: 180, y2: 380 } },
        ],
        incidentFrames: [
          { frame_index: 20, timestamp_sec: 0.8, vehicle_count: 11, zone_idx: 0 }
        ]
      };
      break;

    case 'congestion':
    case 'scenario_c':
      scenarioConfig = {
        id: 'congestion',
        code: 'Scenario C',
        title: 'Sudden Heavy Congestion (HITEC City Bottleneck)',
        description: 'Severe rush-hour queue formation with heavy vehicle mix and gridlock potential.',
        vehicleCount: 24,
        source: 'demo_scenario_hitec_bottleneck.mp4',
        byClass: { car: 14, motorcycle: 3, truck: 4, bus: 3 },
        vehicles: [
          // 14 cars
          { vehicle_class: 'car', confidence: 0.95, bbox: { x1: 80, y1: 500, x2: 220, y2: 620 } },
          { vehicle_class: 'car', confidence: 0.93, bbox: { x1: 240, y1: 460, x2: 360, y2: 570 } },
          { vehicle_class: 'car', confidence: 0.91, bbox: { x1: 380, y1: 420, x2: 490, y2: 520 } },
          { vehicle_class: 'car', confidence: 0.90, bbox: { x1: 510, y1: 380, x2: 610, y2: 470 } },
          { vehicle_class: 'car', confidence: 0.89, bbox: { x1: 630, y1: 340, x2: 720, y2: 420 } },
          { vehicle_class: 'car', confidence: 0.88, bbox: { x1: 730, y1: 300, x2: 820, y2: 380 } },
          { vehicle_class: 'car', confidence: 0.87, bbox: { x1: 150, y1: 390, x2: 270, y2: 490 } },
          { vehicle_class: 'car', confidence: 0.86, bbox: { x1: 290, y1: 350, x2: 400, y2: 440 } },
          { vehicle_class: 'car', confidence: 0.85, bbox: { x1: 420, y1: 310, x2: 510, y2: 390 } },
          { vehicle_class: 'car', confidence: 0.84, bbox: { x1: 540, y1: 270, x2: 620, y2: 350 } },
          { vehicle_class: 'car', confidence: 0.83, bbox: { x1: 640, y1: 230, x2: 720, y2: 300 } },
          { vehicle_class: 'car', confidence: 0.82, bbox: { x1: 200, y1: 270, x2: 300, y2: 350 } },
          { vehicle_class: 'car', confidence: 0.80, bbox: { x1: 330, y1: 230, x2: 420, y2: 300 } },
          { vehicle_class: 'car', confidence: 0.79, bbox: { x1: 450, y1: 200, x2: 530, y2: 260 } },
          // 4 trucks
          { vehicle_class: 'truck', confidence: 0.89, bbox: { x1: 40, y1: 280, x2: 170, y2: 460 } },
          { vehicle_class: 'truck', confidence: 0.85, bbox: { x1: 220, y1: 160, x2: 350, y2: 310 } },
          { vehicle_class: 'truck', confidence: 0.83, bbox: { x1: 420, y1: 120, x2: 540, y2: 250 } },
          { vehicle_class: 'truck', confidence: 0.81, bbox: { x1: 580, y1: 100, x2: 690, y2: 220 } },
          // 3 buses
          { vehicle_class: 'bus', confidence: 0.92, bbox: { x1: 10, y1: 140, x2: 150, y2: 310 } },
          { vehicle_class: 'bus', confidence: 0.88, bbox: { x1: 300, y1: 80, x2: 430, y2: 220 } },
          { vehicle_class: 'bus', confidence: 0.87, bbox: { x1: 700, y1: 160, x2: 830, y2: 310 } },
          // 3 motorcycles
          { vehicle_class: 'motorcycle', confidence: 0.84, bbox: { x1: 250, y1: 420, x2: 280, y2: 470 } },
          { vehicle_class: 'motorcycle', confidence: 0.81, bbox: { x1: 480, y1: 360, x2: 510, y2: 410 } },
          { vehicle_class: 'motorcycle', confidence: 0.78, bbox: { x1: 610, y1: 300, x2: 640, y2: 350 } },
        ],
        incidentFrames: [
          { frame_index: 5, timestamp_sec: 0.2, vehicle_count: 18, zone_idx: 0 },
          { frame_index: 10, timestamp_sec: 0.4, vehicle_count: 22, zone_idx: 0 },
          { frame_index: 15, timestamp_sec: 0.6, vehicle_count: 24, zone_idx: 1 },
          { frame_index: 20, timestamp_sec: 0.8, vehicle_count: 25, zone_idx: 0 },
        ]
      };
      break;

    case 'incident':
    case 'scenario_d':
    default:
      scenarioConfig = {
        id: 'incident',
        code: 'Scenario D',
        title: 'Collision & Road Obstruction (Madhapur Connector)',
        description: 'Multi-vehicle collision and stalled lane obstruction triggering emergency priority.',
        vehicleCount: 21,
        source: 'demo_scenario_accident_obstruction.mp4',
        byClass: { car: 12, motorcycle: 4, truck: 3, bus: 2 },
        vehicles: [
          { vehicle_class: 'car', confidence: 0.93, bbox: { x1: 260, y1: 380, x2: 380, y2: 490 } },
          { vehicle_class: 'car', confidence: 0.91, bbox: { x1: 390, y1: 370, x2: 500, y2: 470 } },
          { vehicle_class: 'truck', confidence: 0.89, bbox: { x1: 120, y1: 300, x2: 260, y2: 460 } },
          { vehicle_class: 'bus', confidence: 0.86, bbox: { x1: 520, y1: 260, x2: 660, y2: 410 } },
          { vehicle_class: 'car', confidence: 0.85, bbox: { x1: 670, y1: 310, x2: 780, y2: 400 } },
          { vehicle_class: 'car', confidence: 0.84, bbox: { x1: 180, y1: 220, x2: 280, y2: 310 } },
          { vehicle_class: 'car', confidence: 0.83, bbox: { x1: 300, y1: 210, x2: 400, y2: 290 } },
          { vehicle_class: 'car', confidence: 0.82, bbox: { x1: 420, y1: 190, x2: 510, y2: 270 } },
          { vehicle_class: 'motorcycle', confidence: 0.85, bbox: { x1: 240, y1: 350, x2: 270, y2: 400 } },
          { vehicle_class: 'motorcycle', confidence: 0.82, bbox: { x1: 490, y1: 340, x2: 520, y2: 390 } },
          { vehicle_class: 'truck', confidence: 0.80, bbox: { x1: 580, y1: 160, x2: 690, y2: 280 } },
          { vehicle_class: 'bus', confidence: 0.79, bbox: { x1: 40, y1: 180, x2: 160, y2: 320 } },
        ],
        incidentFrames: [
          { frame_index: 8, timestamp_sec: 0.32, vehicle_count: 20, zone_idx: 2 },
          { frame_index: 12, timestamp_sec: 0.48, vehicle_count: 21, zone_idx: 2 },
          { frame_index: 16, timestamp_sec: 0.64, vehicle_count: 21, zone_idx: 0 },
        ]
      };
      break;
  }

  // Calculate mathematically rigorous rule-based risk score Rt
  const simulatedData = {
    summary: {
      total_vehicle_detections: scenarioConfig.vehicleCount * 10,
      avg_vehicles_per_frame: scenarioConfig.vehicleCount,
      peak_vehicles_in_frame: scenarioConfig.vehicleCount,
      by_class: scenarioConfig.byClass
    },
    frames: [
      {
        frame_index: 0,
        timestamp_sec: 0.0,
        vehicle_count: scenarioConfig.vehicleCount,
        vehicles: scenarioConfig.vehicles
      }
    ]
  };

  const riskAssessment = calculateRisk(simulatedData);

  // Map zone risk scores
  const zones = HYDERABAD_ZONES.map(z => {
    let zoneScore;
    if (scenarioConfig.id === 'congestion') {
      // In HITEC bottleneck, concentrate extreme score in HITEC City & Gachibowli
      if (z.id === 'hitec-city') zoneScore = 98;
      else if (z.id === 'gachibowli') zoneScore = 91;
      else if (z.id === 'madhapur') zoneScore = 84;
      else zoneScore = Math.min(Math.round(riskAssessment.score * z.weight), 100);
    } else if (scenarioConfig.id === 'incident') {
      // In Madhapur obstruction, focus on Madhapur and HITEC connector
      if (z.id === 'madhapur') zoneScore = 92;
      else if (z.id === 'hitec-city') zoneScore = 85;
      else zoneScore = Math.min(Math.round(riskAssessment.score * z.weight), 100);
    } else {
      zoneScore = Math.min(Math.max(Math.round(riskAssessment.score * z.weight), 0), 100);
    }

    return {
      id: z.id,
      name: z.name,
      lat: z.lat,
      lon: z.lon,
      score: zoneScore,
      category: getRiskCategory(zoneScore),
      color: riskColor(zoneScore),
      data_note: `Demo simulation: ${scenarioConfig.code}`
    };
  });

  // Construct incidents list
  const incidents = (scenarioConfig.incidentFrames || []).map((inc, i) => {
    const zone = HYDERABAD_ZONES[inc.zone_idx % HYDERABAD_ZONES.length];
    const score = zones.find(z => z.id === zone.id)?.score || riskAssessment.score;
    return {
      id: `INC-SIM-${String(i + 1).padStart(3, '0')}`,
      frame_index: inc.frame_index,
      timestamp_sec: inc.timestamp_sec,
      vehicle_count: inc.vehicle_count,
      zone_id: zone.id,
      zone_name: zone.name,
      severity: getRiskCategory(score),
      score: score,
      color: riskColor(score),
      data_note: `Simulated event: ${scenarioConfig.title}`
    };
  });

  // Generate simulated frame sequence for table
  const frames = [
    {
      frame_index: 0,
      timestamp_sec: 0.0,
      vehicle_count: scenarioConfig.vehicleCount,
      vehicles: scenarioConfig.vehicles
    },
    {
      frame_index: 5,
      timestamp_sec: 0.2,
      vehicle_count: scenarioConfig.vehicleCount,
      vehicles: scenarioConfig.vehicles.slice(0, Math.max(3, scenarioConfig.vehicles.length - 2))
    }
  ];

  return {
    event: 'live_traffic_update',
    is_scenario: true,
    scenario_id: scenarioConfig.id,
    scenario_code: scenarioConfig.code,
    scenario_title: scenarioConfig.title,
    scenario_description: scenarioConfig.description,
    timestamp: timestamp,
    source: scenarioConfig.source,
    vehicle_count: scenarioConfig.vehicleCount,
    latest_frame: frames[0],
    summary: {
      total_vehicle_detections: scenarioConfig.vehicleCount * 10,
      avg_vehicles_per_frame: scenarioConfig.vehicleCount,
      peak_vehicles_in_frame: scenarioConfig.vehicleCount,
      by_class: scenarioConfig.byClass
    },
    risk: riskAssessment,
    zones: zones,
    incidents: incidents,
    frames: frames,
    frames_processed: 10,
    data_note: `Demo Scenario Runner: ${scenarioConfig.code} — ${scenarioConfig.title}`
  };
}

const AVAILABLE_SCENARIOS = [
  { id: 'normal', code: 'Scenario A', name: 'Normal Flow (Low Rt - Green)', badge: 'Low Risk', color: '#34d399' },
  { id: 'moderate', code: 'Scenario B', name: 'Moderate Traffic (Medium Rt - Amber)', badge: 'Medium Risk', color: '#fbbf24' },
  { id: 'congestion', code: 'Scenario C', name: 'Heavy Congestion in HITEC City (Critical Rt - Red)', badge: 'Critical Risk', color: '#f87171' },
  { id: 'incident', code: 'Scenario D', name: 'Collision & Road Obstruction (High Rt - Red)', badge: 'High Risk', color: '#fb923c' }
];

module.exports = {
  buildScenarioPayload,
  AVAILABLE_SCENARIOS,
  HYDERABAD_ZONES,
  riskColor
};
