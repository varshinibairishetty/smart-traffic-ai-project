// backend/config/locations.js
//
// Configuration of core monitored traffic locations in Hyderabad, Telangana, India.
// Provides precise geographic coordinates (WGS84), nominal speed limits,
// and metropolitan bounding box for incident and flow querying.

const HYDERABAD_LOCATIONS = [
  {
    id: 'hitec-city',
    name: 'HITEC City (Cyber Towers Junction)',
    short_name: 'HITEC City',
    corridor: 'Madhapur - Gachibowli Arterial',
    category: 'IT Corridor / Multi-way Overpass',
    latitude: 17.4504,
    longitude: 78.3808,
    speed_limit_kmh: 50,
    description: 'Major intersection connecting Cyber Towers, Mindspace, and the Financial District.'
  },
  {
    id: 'gachibowli',
    name: 'Gachibowli Junction (ORR Interlink)',
    short_name: 'Gachibowli',
    corridor: 'Outer Ring Road (ORR) Arterial',
    category: 'Arterial Expressway Interlink',
    latitude: 17.4401,
    longitude: 78.3489,
    speed_limit_kmh: 60,
    description: 'High-speed junction connecting Financial District, ORR flyover, and HCU.'
  },
  {
    id: 'madhapur',
    name: 'Madhapur (Mindspace / Durgam Cheruvu)',
    short_name: 'Madhapur',
    corridor: 'Durgam Cheruvu Incline Corridor',
    category: 'Urban Bottleneck Corridor',
    latitude: 17.4481,
    longitude: 78.3915,
    speed_limit_kmh: 40,
    description: 'High-density link road approaching Durgam Cheruvu Cable Bridge.'
  },
  {
    id: 'kukatpally',
    name: 'Kukatpally (Y-Junction / NH 65)',
    short_name: 'Kukatpally',
    corridor: 'National Highway 65 / Balanagar Link',
    category: 'Dense Commercial Transit Node',
    latitude: 17.4875,
    longitude: 78.4037,
    speed_limit_kmh: 50,
    description: 'Major transit choke-point connecting Northern suburbs and industrial zones.'
  },
  {
    id: 'punjagutta',
    name: 'Punjagutta (Central Flyover Hub)',
    short_name: 'Punjagutta',
    corridor: 'Central Hyderabad Inner Ring',
    category: 'High-Volume Central Flyover Node',
    latitude: 17.4265,
    longitude: 78.4526,
    speed_limit_kmh: 40,
    description: 'Historic commercial junction with multi-tier flyover connecting Banjara Hills and Begumpet.'
  },
  {
    id: 'secunderabad',
    name: 'Secunderabad (Clock Tower / Station Corridor)',
    short_name: 'Secunderabad',
    corridor: 'Twin City Connector Arterial',
    category: 'Mixed Transit Hub & Rail Terminal Link',
    latitude: 17.4411,
    longitude: 78.4983,
    speed_limit_kmh: 40,
    description: 'Transit hub adjacent to major railway terminal and intercity bus stands.'
  }
];

// Bounding box for Greater Hyderabad metropolitan area [minLon, minLat, maxLon, maxLat]
const HYDERABAD_METRO_BBOX = {
  min_lon: 78.30,
  min_lat: 17.34,
  max_lon: 78.56,
  max_lat: 17.52
};

function getLocationById(id) {
  if (!id) return null;
  const target = String(id).toLowerCase().trim();
  return HYDERABAD_LOCATIONS.find(loc => 
    loc.id.toLowerCase() === target || 
    loc.short_name.toLowerCase() === target
  ) || null;
}

module.exports = {
  HYDERABAD_LOCATIONS,
  HYDERABAD_METRO_BBOX,
  getLocationById
};
