// backend/__tests__/notificationService.test.js
//
// Integration & unit tests for the Automated Incident Notification & Webhook Dispatcher.

const request = require('supertest');
const { app, server } = require('../server');
const notificationService = require('../utils/notificationService');

describe('Automated Incident Notification & Webhook Dispatcher', () => {
  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('NotificationService Core Engine', () => {
    test('returns default configuration with all channels enabled and threshold 70', () => {
      const config = notificationService.getConfig();
      expect(config).toHaveProperty('enabled');
      expect(config.enabled).toBe(true);
      expect(config.minRiskScore).toBe(70);
      expect(config.channels).toHaveProperty('email');
      expect(config.channels).toHaveProperty('sms');
      expect(config.channels).toHaveProperty('webhook');
      expect(typeof config.webhookUrl).toBe('string');
    });

    test('updates configuration parameters correctly', () => {
      const updated = notificationService.updateConfig({
        minRiskScore: 75,
        channels: { email: true, sms: false, webhook: true }
      });
      expect(updated.minRiskScore).toBe(75);
      expect(updated.channels.sms).toBe(false);

      // Restore default
      notificationService.updateConfig({
        minRiskScore: 70,
        channels: { email: true, sms: true, webhook: true }
      });
    });

    test('ignores low-risk incidents below threshold (Rt < 70)', async () => {
      const lowRiskIncident = {
        id: 'INC-LOW-TEST',
        node_location: 'Kondapur',
        zone_id: 'kondapur',
        sub_zone: 'RTA Crossroads',
        risk_score: 42,
        severity: 'Medium'
      };

      const result = await notificationService.dispatchForIncident(lowRiskIncident);
      expect(result).toBeNull();
    });

    test('dispatches alerts for high-risk incidents (Rt >= 70) across active channels', async () => {
      const highRiskIncident = {
        id: `INC-HIGH-${Date.now()}`,
        node_location: 'HITEC City',
        zone_id: `hitec-test-${Date.now()}`,
        sub_zone: 'Cyber Towers Flyover',
        risk_score: 89,
        severity: 'Critical',
        vehicle_count: 22,
        description: 'Severe congestion bottleneck detected at Cyber Towers.'
      };

      const result = await notificationService.dispatchForIncident(highRiskIncident);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^NOTIF-/);
      expect(result.incident_id).toBe(highRiskIncident.id);
      expect(result.risk_score).toBe(89);
      expect(result.severity).toBe('Critical');
      expect(result.channels).toContain('email');
      expect(result.channels).toContain('sms');
      expect(result.channels).toContain('webhook');
      expect(result.details).toHaveProperty('email');
      expect(result.details).toHaveProperty('sms');
      expect(result.details).toHaveProperty('webhook');
      expect(result.details.email.status).toContain('Mock');
    });

    test('suppresses duplicate dispatches for the same zone within cooldown window', async () => {
      const uniqueZone = `zone-dedupe-${Date.now()}`;
      const incident = {
        id: `INC-DEDUPE-1`,
        node_location: 'Gachibowli',
        zone_id: uniqueZone,
        sub_zone: 'Bio-Diversity Flyover',
        risk_score: 85,
        severity: 'Critical'
      };

      const first = await notificationService.dispatchForIncident(incident);
      expect(first).not.toBeNull();

      // Immediate duplicate trigger for same zone and similar score
      const duplicate = await notificationService.dispatchForIncident({
        ...incident,
        id: `INC-DEDUPE-2`
      });
      expect(duplicate).toBeNull();
    });
  });

  describe('REST API Notification Endpoints', () => {
    test('GET /api/notifications returns dispatch history and aggregated analytics', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('analytics');
      expect(res.body.analytics).toHaveProperty('by_severity');
      expect(res.body.analytics).toHaveProperty('by_channel');
      expect(res.body).toHaveProperty('config');
    });

    test('GET /api/notifications?limit=2 respects limit parameter', async () => {
      const res = await request(app).get('/api/notifications?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBeLessThanOrEqual(2);
    });

    test('GET /api/notifications/config returns active dispatch channels and triggers', async () => {
      const res = await request(app).get('/api/notifications/config');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('config');
      expect(res.body.config).toHaveProperty('channels');
      expect(res.body.config).toHaveProperty('minRiskScore');
    });

    test('PATCH /api/notifications/config updates configuration', async () => {
      const res = await request(app)
        .patch('/api/notifications/config')
        .send({
          minRiskScore: 72,
          channels: { email: true, sms: true, webhook: true }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config.minRiskScore).toBe(72);

      // Restore to 70
      await request(app)
        .patch('/api/notifications/config')
        .send({ minRiskScore: 70 });
    });

    test('POST /api/notifications/test triggers an immediate test alert dispatch', async () => {
      const res = await request(app)
        .post('/api/notifications/test')
        .send({
          node_location: 'Madhapur',
          sub_zone: 'Metro Pillar 1042 Corridor',
          risk_score: 86
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notification).toHaveProperty('id');
      expect(res.body.notification.node_location).toBe('Madhapur');
      expect(res.body.notification.channels.length).toBeGreaterThan(0);
    });

    test('POST /api/notifications/mock-webhook receives and acknowledges municipal payload', async () => {
      const mockPayload = {
        event: 'TRAFFIC_INCIDENT_ALERT',
        notification_id: 'NOTIF-MOCK-TEST',
        incident_id: 'INC-MOCK-1',
        alert: {
          node_location: 'HITEC City',
          risk_score: 92,
          severity: 'Critical'
        }
      };

      const res = await request(app)
        .post('/api/notifications/mock-webhook')
        .send(mockPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.acknowledged).toBe(true);
      expect(res.body).toHaveProperty('receiver');
      expect(res.body).toHaveProperty('received_at');
    });
  });
});
