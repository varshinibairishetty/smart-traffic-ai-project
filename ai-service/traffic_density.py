# ai-service/traffic_density.py
#
# Stage 4 Traffic Density & Congestion Analysis Engine.
#
# Computes physical corridor saturation, flow classifications, and peak period indicators
# from per-frame detections and multi-object tracking metrics.

from typing import Dict, List, Optional

# Standard municipal capacity constant:
# Maximum simultaneous vehicles in camera viewport before gridlock occurs.
DEFAULT_SATURATION_CAPACITY = 25  # K_sat


def classify_congestion(density_pct: float) -> Dict[str, str]:
    """
    Classify traffic flow into municipal operational tiers based on road density percentage.

    Tiers:
      - 0% - 39.9%: Free Flow (Level of Service A/B)
      - 40% - 69.9%: Moderate Flow (Level of Service C/D)
      - 70% - 84.9%: Congested (Level of Service E)
      - 85% - 100%:  Severe Bottleneck / Gridlock (Level of Service F)
    """
    if density_pct >= 85.0:
        return {
            "status": "Severe Bottleneck",
            "tier": "Critical",
            "color": "#ef4444",
            "los": "F",
            "description": "Corridor capacity exceeded; gridlock conditions imminent.",
        }
    elif density_pct >= 70.0:
        return {
            "status": "Congested",
            "tier": "High",
            "color": "#f97316",
            "los": "E",
            "description": "High vehicle accumulation; intermittent stop-and-go delays.",
        }
    elif density_pct >= 40.0:
        return {
            "status": "Moderate",
            "tier": "Medium",
            "color": "#fbbf24",
            "los": "C/D",
            "description": "Stable traffic stream with controlled speeds approaching capacity.",
        }
    else:
        return {
            "status": "Free Flow",
            "tier": "Low",
            "color": "#22c55e",
            "los": "A/B",
            "description": "Unimpeded vehicular movement operating well below saturation.",
        }


def analyze_traffic_density(
    current_vehicle_count: int,
    unique_vehicles_tracked: int = 0,
    line_crossings: int = 0,
    duration_sec: float = 1.0,
    saturation_capacity: int = DEFAULT_SATURATION_CAPACITY,
) -> dict:
    """
    Compute traffic density, flow rate (vehicles per minute), and congestion status.

    Args:
        current_vehicle_count: Instantaneous vehicles visible in current frame (V_t).
        unique_vehicles_tracked: Distinct vehicles identified by tracker (N_unique).
        line_crossings: Vehicles that crossed the virtual tripwire (Q).
        duration_sec: Elapsed elapsed video duration in seconds.
        saturation_capacity: Viewport capacity threshold K_sat (default 25).

    Returns:
        Structured dictionary containing density metrics and operational classifications.
    """
    k_sat = max(1, saturation_capacity)
    density_pct = min(100.0, round((current_vehicle_count / k_sat) * 100.0, 1))

    # Flow rate calculation: vehicles crossing per minute
    minutes = max(0.016, duration_sec / 60.0)
    flow_rate_vpm = round(line_crossings / minutes, 1)

    classification = classify_congestion(density_pct)

    return {
        "instantaneous_vehicles": current_vehicle_count,
        "saturation_capacity": k_sat,
        "density_pct": density_pct,
        "congestion_status": classification["status"],
        "congestion_tier": classification["tier"],
        "congestion_color": classification["color"],
        "level_of_service": classification["los"],
        "operational_note": classification["description"],
        "flow_rate_vpm": flow_rate_vpm,
        "total_line_crossings": line_crossings,
        "unique_vehicles_tracked": unique_vehicles_tracked,
    }
