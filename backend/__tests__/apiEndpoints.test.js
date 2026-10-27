// backend/__tests__/apiEndpoints.test.js
//
// Integration & unit tests for key Express API endpoints using Supertest.

const request = require('supertest');
const { app, server } = require('../server');

describe('Backend REST API Endpoints', () => {
  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('GET /health & /api/health (Production Healthcheck)', () => {
    test('returns 200 with structured JSON health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('storage');
      expect(res.body.checks).toHaveProperty('websocket');
      expect(res.body.checks).toHaveProperty('system');
    });

    test('/api/health alias matches /health response shape', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('traffic-backend-api');
    });
  });

  describe('GET /api/zones', () => {
    test('returns 6 Hyderabad regional intersections with valid coordinates and risk colors', async () => {
      const res = await request(app).get('/api/zones');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.zones)).toBe(true);
      expect(res.body.zones.length).toBe(6);

      const firstZone = res.body.zones[0];
      expect(firstZone).toHaveProperty('id');
      expect(firstZone).toHaveProperty('name');
      expect(firstZone).toHaveProperty('lat');
      expect(firstZone).toHaveProperty('lon');
      expect(firstZone).toHaveProperty('score');
      expect(firstZone).toHaveProperty('category');
      expect(firstZone).toHaveProperty('color');
    });
  });

  describe('GET /api/incidents', () => {
    test('returns persistent incidents history and aggregated counts', async () => {
      const res = await request(app).get('/api/incidents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.incidents)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('active_count');
      expect(res.body).toHaveProperty('resolved_count');
      expect(res.body).toHaveProperty('analytics');
    });
  });

  describe('GET /api/cameras', () => {
    test('returns surveillance grid for cameras VID-001 through VID-005', async () => {
      const res = await request(app).get('/api/cameras');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.cameras)).toBe(true);
      expect(res.body.cameras.length).toBe(5);

      const cam1 = res.body.cameras[0];
      expect(cam1.id).toBe('VID-001');
      expect(cam1).toHaveProperty('stream_url');
      expect(cam1).toHaveProperty('resolution');
      expect(cam1).toHaveProperty('current_risk');
    });
  });

  describe('GET /api/analytics/summary', () => {
    test('returns historical KPIs, volume trends, and node comparisons', async () => {
      const res = await request(app).get('/api/analytics/summary');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('kpis');
      expect(res.body.kpis).toHaveProperty('avg_speed_kmh');
      expect(res.body.kpis).toHaveProperty('avg_density_pct');
      expect(Array.isArray(res.body.volume_trends)).toBe(true);
      expect(Array.isArray(res.body.node_comparison)).toBe(true);
    });
  });

  describe('GET /api/demo/scenarios', () => {
    test('returns available demo/viva presentation scenarios', async () => {
      const res = await request(app).get('/api/demo/scenarios');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.scenarios)).toBe(true);
      expect(res.body.scenarios.length).toBeGreaterThan(0);
    });
  });
});
