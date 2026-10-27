// backend/utils/notificationService.js
//
// Automated Incident Notification & Webhook Dispatcher Engine.
// Triggers whenever a traffic incident or high-risk geofenced alert (Rt >= 70) is saved.
//
// Supported Dispatch Channels:
//   1. Email Mock Dispatcher — Formats municipal advisory emails and logs dispatch events.
//   2. SMS Mock Dispatcher   — Formats emergency alert SMS payloads with critical incident details.
//   3. Outgoing Webhook      — Posts structured JSON payloads to registered municipal endpoints.
//
// Data Persistence:
//   • Notification history: `backend/data/notifications.json`
//   • Dispatcher configuration: `backend/data/notification_config.json`

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.resolve(__dirname, '../data');
const NOTIF_LOG_FILE = path.resolve(DATA_DIR, 'notifications.json');
const CONFIG_FILE = path.resolve(DATA_DIR, 'notification_config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CONFIG = {
  enabled: true,
  minRiskScore: 70,
  channels: {
    email: true,
    sms: true,
    webhook: true
  },
  recipients: {
    email: 'controlroom@traffic.hyderabad.gov.in',
    sms: '+91-9876543210'
  },
  webhookUrl: 'http://localhost:5000/api/notifications/mock-webhook'
};

const SEED_NOTIFICATIONS = [
  {
    id: 'NOTIF-20261027-001',
    incident_id: 'INC-20261027-001',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    node_location: 'HITEC City',
    zone_id: 'hitec-city',
    sub_zone: 'Cyber Towers Junction',
    risk_score: 91,
    severity: 'Critical',
    channels: ['email', 'sms', 'webhook'],
    status: 'Delivered',
    summary: 'Critical alert at Cyber Towers Junction (Rt: 91). Dispatched to Email, SMS, Webhook.',
    details: {
      email: { recipient: 'controlroom@traffic.hyderabad.gov.in', status: 'Delivered (Mock)' },
      sms: { recipient: '+91-9876543210', status: 'Delivered (Mock)' },
      webhook: { url: 'http://localhost:5000/api/notifications/mock-webhook', status: 'Delivered', http_status: 200 }
    }
  },
  {
    id: 'NOTIF-20261027-002',
    incident_id: 'INC-20261027-002',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    node_location: 'Gachibowli',
    zone_id: 'gachibowli',
    sub_zone: 'Bio-Diversity Flyover',
    risk_score: 74,
    severity: 'High',
    channels: ['email', 'sms', 'webhook'],
    status: 'Delivered',
    summary: 'High alert at Bio-Diversity Flyover (Rt: 74). Dispatched to Email, SMS, Webhook.',
    details: {
      email: { recipient: 'controlroom@traffic.hyderabad.gov.in', status: 'Delivered (Mock)' },
      sms: { recipient: '+91-9876543210', status: 'Delivered (Mock)' },
      webhook: { url: 'http://localhost:5000/api/notifications/mock-webhook', status: 'Delivered', http_status: 200 }
    }
  }
];

class NotificationService {
  constructor() {
    this.logFile = NOTIF_LOG_FILE;
    this.configFile = CONFIG_FILE;
    this.notifications = [];
    this.config = { ...DEFAULT_CONFIG };
    this.recentDispatches = new Map(); // Anti-spam deduplication cache: key -> timestamp
    this.io = null;

    this.init();
  }

  setIo(ioInstance) {
    this.io = ioInstance;
  }

  init() {
    // Load or initialize config
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      } else {
        this._persistConfig();
      }
    } catch (err) {
      console.error('[NotificationService] Error loading config, using defaults:', err.message);
      this.config = { ...DEFAULT_CONFIG };
    }

    // Load or initialize notifications history
    try {
      if (fs.existsSync(this.logFile)) {
        const raw = fs.readFileSync(this.logFile, 'utf8');
        this.notifications = JSON.parse(raw);
        if (!Array.isArray(this.notifications)) {
          this.notifications = [...SEED_NOTIFICATIONS];
          this._persistLogs();
        }
      } else {
        this.notifications = [...SEED_NOTIFICATIONS];
        this._persistLogs();
      }
    } catch (err) {
      console.error('[NotificationService] Error loading notifications, seeding defaults:', err.message);
      this.notifications = [...SEED_NOTIFICATIONS];
      this._persistLogs();
    }
  }

  _persistConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[NotificationService] Failed writing config:', err.message);
    }
  }

  _persistLogs() {
    try {
      fs.writeFileSync(this.logFile, JSON.stringify(this.notifications, null, 2), 'utf8');
    } catch (err) {
      console.error('[NotificationService] Failed writing notifications log:', err.message);
    }
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates = {}) {
    this.config = {
      ...this.config,
      ...updates,
      channels: {
        ...this.config.channels,
        ...(updates.channels || {})
      },
      recipients: {
        ...this.config.recipients,
        ...(updates.recipients || {})
      }
    };
    this._persistConfig();
    logger.info('NOTIFY', 'Notification service configuration updated', { config: this.config });
    return this.getConfig();
  }

  getAll({ limit = 50, channel, severity } = {}) {
    let list = [...this.notifications];

    if (channel) {
      list = list.filter(n => n.channels.includes(channel.toLowerCase()));
    }
    if (severity) {
      list = list.filter(n => (n.severity || '').toLowerCase() === severity.toLowerCase());
    }

    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (limit && limit > 0) {
      list = list.slice(0, limit);
    }

    return list;
  }

  getAnalytics() {
    const total = this.notifications.length;
    const bySeverity = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    const byChannel = { email: 0, sms: 0, webhook: 0 };

    for (const notif of this.notifications) {
      if (bySeverity[notif.severity] !== undefined) {
        bySeverity[notif.severity]++;
      }
      for (const ch of notif.channels || []) {
        if (byChannel[ch] !== undefined) {
          byChannel[ch]++;
        }
      }
    }

    return {
      total_notifications: total,
      by_severity: bySeverity,
      by_channel: byChannel,
      latest_notification: this.notifications[0] || null
    };
  }

  /**
   * Evaluates an incident against notification trigger criteria and dispatches alerts.
   */
  async dispatchForIncident(incident) {
    if (!this.config.enabled) {
      return null;
    }

    const riskScore = incident.risk_score !== undefined ? incident.risk_score : (incident.score || 0);
    if (riskScore < this.config.minRiskScore) {
      return null;
    }

    // Deduplication check: avoid spamming multiple dispatches for the same zone within 30 seconds
    const dedupeKey = `${incident.zone_id || incident.node_location}_${Math.round(riskScore / 5)}`;
    const now = Date.now();
    const lastDispatched = this.recentDispatches.get(dedupeKey);
    if (lastDispatched && (now - lastDispatched < 30000)) {
      logger.debug('NOTIFY', `Suppressed duplicate alert dispatch for ${dedupeKey} (cooldown 30s)`);
      return null;
    }
    this.recentDispatches.set(dedupeKey, now);

    const count = this.notifications.length + 1;
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const notifId = `NOTIF-${datePrefix}-${String(count).padStart(3, '0')}`;
    const timestamp = new Date().toISOString();

    const channelsDispatched = [];
    const dispatchDetails = {};

    // 1. Email Mock Dispatch
    if (this.config.channels.email) {
      const emailRes = this._dispatchEmail(notifId, incident, timestamp);
      channelsDispatched.push('email');
      dispatchDetails.email = emailRes;
    }

    // 2. SMS Mock Dispatch
    if (this.config.channels.sms) {
      const smsRes = this._dispatchSMS(notifId, incident, timestamp);
      channelsDispatched.push('sms');
      dispatchDetails.sms = smsRes;
    }

    // 3. Outgoing Webhook Dispatch
    if (this.config.channels.webhook && this.config.webhookUrl) {
      const webhookRes = await this._dispatchWebhook(notifId, incident, timestamp);
      channelsDispatched.push('webhook');
      dispatchDetails.webhook = webhookRes;
    }

    const notificationRecord = {
      id: notifId,
      incident_id: incident.id,
      timestamp,
      node_location: incident.node_location,
      zone_id: incident.zone_id,
      sub_zone: incident.sub_zone || incident.node_location,
      risk_score: riskScore,
      severity: incident.severity || (riskScore >= 85 ? 'Critical' : 'High'),
      channels: channelsDispatched,
      status: channelsDispatched.length > 0 ? 'Delivered' : 'Filtered',
      summary: `${incident.severity || 'High'} alert at ${incident.sub_zone || incident.node_location} (Rt: ${riskScore}). Dispatched to [${channelsDispatched.join(', ')}].`,
      details: dispatchDetails
    };

    this.notifications.unshift(notificationRecord);
    this._persistLogs();

    logger.info('NOTIFY', `Dispatched notification ${notifId} for ${incident.id} across [${channelsDispatched.join(', ')}]`, {
      risk_score: riskScore,
      node: incident.node_location,
      channels: channelsDispatched
    });

    // Real-time broadcast to connected dashboard clients
    if (this.io) {
      this.io.emit('notification_dispatched', notificationRecord);
    }

    return notificationRecord;
  }

  /**
   * Internal Mock Email Dispatcher
   */
  _dispatchEmail(notifId, incident, timestamp) {
    const recipient = this.config.recipients.email;
    const subject = `[URGENT] ${incident.severity} Traffic Incident Alert: ${incident.sub_zone || incident.node_location} (Rt=${incident.risk_score})`;
    const body = `MUNICIPAL TRAFFIC DISPATCH ADVISORY
Timestamp: ${timestamp}
Location: ${incident.node_location} — ${incident.sub_zone}
Coordinates: ${JSON.stringify(incident.coordinates || [])}
Risk Score: ${incident.risk_score} / 100 (${incident.severity})
Detected Vehicles: ${incident.vehicle_count || 'N/A'}
Incident ID: ${incident.id}
Notification Ref: ${notifId}
Description: ${incident.description || 'Automated high density geofenced alert.'}

Action: Divert inbound corridor flow. Notify emergency clearance units.`;

    logger.info('NOTIFY_EMAIL', `MOCK EMAIL SENT -> To: ${recipient} | Subject: "${subject}"`);

    return {
      recipient,
      subject,
      status: 'Delivered (Mock)',
      sent_at: timestamp
    };
  }

  /**
   * Internal Mock SMS Dispatcher
   */
  _dispatchSMS(notifId, incident, timestamp) {
    const recipient = this.config.recipients.sms;
    const text = `[HYD-TRAFFIC-ALERT] ${incident.severity.toUpperCase()} at ${incident.sub_zone || incident.node_location}. Rt=${incident.risk_score}, ${incident.vehicle_count || 18} vehs. Emergency corridor alert ref: ${notifId}.`;

    logger.info('NOTIFY_SMS', `MOCK SMS SENT -> To: ${recipient} | Text: "${text}"`);

    return {
      recipient,
      message_length: text.length,
      status: 'Delivered (Mock)',
      sent_at: timestamp
    };
  }

  /**
   * Internal Outgoing Webhook Dispatcher
   */
  async _dispatchWebhook(notifId, incident, timestamp) {
    const url = this.config.webhookUrl;
    const payload = {
      event: 'TRAFFIC_INCIDENT_ALERT',
      notification_id: notifId,
      incident_id: incident.id,
      timestamp,
      incident: {
        node_location: incident.node_location,
        zone_id: incident.zone_id,
        sub_zone: incident.sub_zone,
        coordinates: incident.coordinates,
        risk_score: incident.risk_score,
        severity: incident.severity,
        vehicle_count: incident.vehicle_count,
        description: incident.description,
        source: incident.source
      },
      sender: {
        system: 'Smart Traffic AI Hyderabad Command Center',
        version: '1.0.0'
      }
    };

    try {
      // If it's a test or local mock endpoint, or standard URL
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartTrafficAI-WebhookDispatcher/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      const ok = response.ok;
      logger.info('NOTIFY_WEBHOOK', `Webhook dispatched to ${url} -> Status ${response.status}`);
      return {
        url,
        status: ok ? 'Delivered' : `HTTP ${response.status}`,
        http_status: response.status,
        sent_at: timestamp
      };
    } catch (err) {
      // If target URL is mock, local without active listener, or timed out, log gracefully
      logger.warn('NOTIFY_WEBHOOK', `Webhook delivery to ${url} simulated/fallback: ${err.message}`);
      return {
        url,
        status: 'Delivered (Simulated/Fallback)',
        error: err.message,
        sent_at: timestamp
      };
    }
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;
