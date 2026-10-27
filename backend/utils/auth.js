// backend/utils/auth.js
//
// JSON Web Token (JWT) Authentication & Role-Based Access Control (RBAC) engine.
// Roles:
//   • 'operator' — read-only view of live maps, cameras, and incident logs.
//   • 'admin'    — full operational control, scenario simulations, and incident resolution.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-traffic-ai-super-secret-jwt-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Signs a JWT token containing user identity and assigned RBAC role.
 */
function generateToken(user) {
  const payload = {
    id:    user.id,
    email: user.email,
    name:  user.name,
    role:  user.role || 'operator'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Decodes and verifies a JWT token.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware: requires a valid JWT Bearer token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token missing or invalid. Please log in.'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has expired or is invalid.'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Express middleware: optional authentication.
 * Attaches user if token is present, otherwise leaves req.user as guest operator.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  // Fallback to guest operator for viewing during live demo
  req.user = {
    id: 'GUEST',
    email: 'guest@traffic.ai',
    name: 'Guest Viewer',
    role: 'operator'
  };
  next();
}

/**
 * Express middleware factory: restricts route to specific roles (e.g. ['admin']).
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required for this operation.'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Action requires one of the following roles: [${roles.join(', ')}]. Your role is '${req.user.role}'.`
      });
    }

    next();
  };
}

/**
 * Socket.io middleware for handshakes: validates client authentication token.
 */
function wsAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization?.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.split(' ')[1]
      : null);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      socket.user = decoded;
      return next();
    }
  }

  // Allow unauthenticated guest connections for operator view
  socket.user = {
    id: 'WS-GUEST',
    email: 'guest@traffic.ai',
    name: 'Guest Viewer',
    role: 'operator'
  };
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  requireRole,
  wsAuthMiddleware
};
