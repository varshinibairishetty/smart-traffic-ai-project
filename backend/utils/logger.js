// backend/utils/logger.js
//
// Structured Logging Engine for Smart Traffic Backend.
// Provides timestamped, leveled logs (INFO, WARN, ERROR, DEBUG) with JSON metadata,
// an Express HTTP request logger middleware, and a WebSocket event tracer.

const LEVELS = {
  DEBUG: 0,
  INFO:  1,
  WARN:  2,
  ERROR: 3,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL
  ? (LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LEVELS.INFO)
  : LEVELS.INFO;

function formatLog(level, category, message, meta = null) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    category,
    message,
    ...(meta && typeof meta === 'object' ? { meta } : {})
  };

  // In production or when JSON logging is enabled, output structured JSON lines
  if (process.env.LOG_FORMAT === 'json') {
    return JSON.stringify(entry);
  }

  // Developer readable colored format
  const colors = {
    DEBUG: '\x1b[36m', // Cyan
    INFO:  '\x1b[32m', // Green
    WARN:  '\x1b[33m', // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m',
    MUTED: '\x1b[90m',
  };

  const col = colors[level] || colors.RESET;
  const metaStr = meta && Object.keys(meta).length > 0
    ? ` ${colors.MUTED}${JSON.stringify(meta)}${colors.RESET}`
    : '';

  return `${colors.MUTED}${timestamp}${colors.RESET} [${col}${level}${colors.RESET}] [${category}] ${message}${metaStr}`;
}

const logger = {
  debug(category, message, meta) {
    if (CURRENT_LEVEL <= LEVELS.DEBUG) {
      console.log(formatLog('DEBUG', category, message, meta));
    }
  },

  info(category, message, meta) {
    if (CURRENT_LEVEL <= LEVELS.INFO) {
      console.log(formatLog('INFO', category, message, meta));
    }
  },

  warn(category, message, meta) {
    if (CURRENT_LEVEL <= LEVELS.WARN) {
      console.warn(formatLog('WARN', category, message, meta));
    }
  },

  error(category, message, meta) {
    if (CURRENT_LEVEL <= LEVELS.ERROR) {
      console.error(formatLog('ERROR', category, message, meta));
    }
  },

  // Express HTTP Request Logger Middleware (captures method, path, status, duration)
  httpMiddleware() {
    return (req, res, next) => {
      // Skip static assets noise
      if (req.path.startsWith('/assets/') || req.path.endsWith('.svg') || req.path.endsWith('.ico')) {
        return next();
      }

      const start = process.hrtime.bigint();
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

      res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        const status = res.statusCode;
        const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';

        const meta = {
          method: req.method,
          path: req.originalUrl || req.url,
          status,
          duration_ms: Math.round(durationMs * 100) / 100,
          ip: clientIp
        };

        if (level === 'ERROR') {
          logger.error('HTTP', `${req.method} ${req.path} -> ${status} (${meta.duration_ms}ms)`, meta);
        } else if (level === 'WARN') {
          logger.warn('HTTP', `${req.method} ${req.path} -> ${status} (${meta.duration_ms}ms)`, meta);
        } else {
          logger.info('HTTP', `${req.method} ${req.path} -> ${status} (${meta.duration_ms}ms)`, meta);
        }
      });

      next();
    };
  },

  // WebSocket Event Tracer Helper
  wsTrace(event, socketId, details = null) {
    logger.info('WS', `Event: '${event}' from client ${socketId}`, details);
  }
};

module.exports = logger;
