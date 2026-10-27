"""
ai-service/spatial_engine.py

Python spatial geofencing engine for Hyderabad traffic corridors.
Evaluates GPS coordinates of detected vehicles against defined intersection bounding boxes.
"""

import math
from typing import Dict, Any, List, Optional, Tuple

EARTH_RADIUS_METERS = 6371000

HYDERABAD_GEOFENCES = [
    {
        "id": "hitec-city",
        "name": "HITEC City",
        "center": (17.4435, 78.3772),
        "radius_meters": 1200,
        "bbox": {"min_lat": 17.4350, "max_lat": 17.4550, "min_lon": 78.3680, "max_lon": 78.3880},
        "sub_zones": ["Cyber Towers Junction", "Mindspace Roundabout", "HITEC City Metro", "Cyber Gateway"],
        "primary_arterial": "Cyber Towers Junction"
    },
    {
        "id": "gachibowli",
        "name": "Gachibowli",
        "center": (17.4401, 78.3489),
        "radius_meters": 1400,
        "bbox": {"min_lat": 17.4300, "max_lat": 17.4520, "min_lon": 78.3380, "max_lon": 78.3620},
        "sub_zones": ["Bio-Diversity Flyover", "IIIT Junction", "ORR Outer Ramp", "Stadium Circle"],
        "primary_arterial": "Bio-Diversity Flyover"
    },
    {
        "id": "madhapur",
        "name": "Madhapur",
        "center": (17.4481, 78.3915),
        "radius_meters": 1100,
        "bbox": {"min_lat": 17.4400, "max_lat": 17.4600, "min_lon": 78.3820, "max_lon": 78.4020},
        "sub_zones": ["Metro Pillar 1042", "Ayyappa Society Main", "100ft Road Link", "Inorbit Approach"],
        "primary_arterial": "Metro Pillar 1042"
    },
    {
        "id": "jubilee-hills",
        "name": "Jubilee Hills",
        "center": (17.4326, 78.4072),
        "radius_meters": 1300,
        "bbox": {"min_lat": 17.4220, "max_lat": 17.4440, "min_lon": 78.3980, "max_lon": 78.4200},
        "sub_zones": ["Checkpost Circle Road 36", "Peddamma Temple", "Road No 45 Cable Bridge", "Apollo Curve"],
        "primary_arterial": "Checkpost Circle Road 36"
    }
]


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Calculates great-circle distance between two GPS coordinates in meters."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(round(EARTH_RADIUS_METERS * c))


def evaluate_geofence(lat: float, lon: float) -> Dict[str, Any]:
    """Matches GPS coordinates to known Hyderabad geofence bounding boxes."""
    # 1. Bounding box check
    for fence in HYDERABAD_GEOFENCES:
        bbox = fence["bbox"]
        if bbox["min_lat"] <= lat <= bbox["max_lat"] and bbox["min_lon"] <= lon <= bbox["max_lon"]:
            c_lat, c_lon = fence["center"]
            dist = haversine_distance_meters(lat, lon, c_lat, c_lon)
            sub_zone_idx = abs(int((lat + lon) * 1000)) % len(fence["sub_zones"])
            return {
                "matched": True,
                "zone_id": fence["id"],
                "zone_name": fence["name"],
                "sub_zone": fence["sub_zones"][sub_zone_idx],
                "primary_arterial": fence["primary_arterial"],
                "distance_meters": dist,
                "within_radius": dist <= fence["radius_meters"],
                "coordinates": [lat, lon]
            }

    # 2. Nearest center proximity fallback
    nearest = min(HYDERABAD_GEOFENCES, key=lambda f: haversine_distance_meters(lat, lon, f["center"][0], f["center"][1]))
    dist = haversine_distance_meters(lat, lon, nearest["center"][0], nearest["center"][1])
    return {
        "matched": False,
        "zone_id": nearest["id"],
        "zone_name": nearest["name"],
        "sub_zone": nearest["primary_arterial"],
        "primary_arterial": nearest["primary_arterial"],
        "distance_meters": dist,
        "within_radius": dist <= nearest["radius_meters"],
        "coordinates": [lat, lon]
    }
