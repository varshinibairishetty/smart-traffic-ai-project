// backend/__tests__/auth.test.js
//
// Tests for JWT Authentication & Role-Based Access Control (RBAC).

const request = require('supertest');
const { app, server } = require('../server');
const userStore = require('../utils/userStore');
const { generateToken, verifyToken } = require('../utils/auth');

describe('Authentication & Role-Based Access Control (RBAC)', () => {
  let adminToken;
  let operatorToken;

  beforeAll(async () => {
    // Obtain valid tokens for seeded admin and operator users
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@traffic.ai', password: 'Admin@123' });
    adminToken = adminRes.body.token;

    const opRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator@traffic.ai', password: 'Operator@123' });
    operatorToken = opRes.body.token;
  });

  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('JWT Token Helpers', () => {
    test('generateToken produces verifiable JWT with correct user payload', () => {
      const user = { id: 'TEST-1', email: 'test@traffic.ai', name: 'Tester', role: 'operator' };
      const token = generateToken(user);
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded.id).toBe('TEST-1');
      expect(decoded.email).toBe('test@traffic.ai');
      expect(decoded.role).toBe('operator');
    });

    test('verifyToken returns null for forged or malformed tokens', () => {
      expect(verifyToken('invalid.token.here')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });
  });

  describe('POST /api/auth/login', () => {
    test('authenticates admin with valid credentials and returns admin role', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@traffic.ai', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(typeof res.body.token).toBe('string');
    });

    test('authenticates operator with valid credentials and returns operator role', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'operator@traffic.ai', password: 'Operator@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('operator');
      expect(res.body.user.email).toBe('operator@traffic.ai');
    });

    test('rejects incorrect password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@traffic.ai', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('rejects non-existent email with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@traffic.ai', password: 'SomePassword' });

      expect(res.status).toBe(401);
    });

    test('rejects missing credentials with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/register', () => {
    const testEmail = `newuser_${Date.now()}@traffic.ai`;

    test('registers a new user and returns JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Password@123',
          name: 'Traffic Engineer',
          role: 'operator'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe('operator');
      expect(typeof res.body.token).toBe('string');
    });

    test('rejects duplicate email with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Password@123'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    test('rejects short passwords (< 6 characters) with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'short@traffic.ai',
          password: '123'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('returns user profile when valid token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@traffic.ai');
      expect(res.body.user.role).toBe('admin');
    });
  });

  describe('RBAC Route Protection', () => {
    describe('POST /api/demo/scenario', () => {
      test('blocks unauthenticated request with 401 Unauthorized', async () => {
        const res = await request(app)
          .post('/api/demo/scenario')
          .send({ scenario: 'reset' });

        expect(res.status).toBe(401);
      });

      test('blocks operator user with 403 Forbidden', async () => {
        const res = await request(app)
          .post('/api/demo/scenario')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({ scenario: 'reset' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
        expect(res.body.message).toContain('Your role is \'operator\'');
      });

      test('allows admin user to trigger scenario with 200 OK', async () => {
        const res = await request(app)
          .post('/api/demo/scenario')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ scenario: 'reset' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('POST /api/incidents/:id/resolve', () => {
      test('blocks unauthenticated request with 401 Unauthorized', async () => {
        const res = await request(app)
          .post('/api/incidents/INC-TEST/resolve')
          .send({});

        expect(res.status).toBe(401);
      });

      test('blocks operator user with 403 Forbidden', async () => {
        const res = await request(app)
          .post('/api/incidents/INC-TEST/resolve')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({});

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      });
    });
  });
});
