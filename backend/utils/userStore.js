// backend/utils/userStore.js
//
// Persistent local storage layer for user accounts and RBAC roles.
// Uses structured JSON file storage at `backend/data/users.json`.
// Passwords are encrypted with bcryptjs (cost factor 10).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed default users for instant presentation access
const SEED_USERS = [
  {
    id: 'USR-001',
    email: 'admin@traffic.ai',
    name: 'Traffic System Admin',
    role: 'admin',
    passwordHash: bcrypt.hashSync('Admin@123', 10),
    created_at: new Date('2026-10-27T00:00:00Z').toISOString()
  },
  {
    id: 'USR-002',
    email: 'operator@traffic.ai',
    name: 'Cyberabad Control Operator',
    role: 'operator',
    passwordHash: bcrypt.hashSync('Operator@123', 10),
    created_at: new Date('2026-10-27T00:00:00Z').toISOString()
  }
];

class UserStore {
  constructor() {
    this.filePath = USERS_FILE;
    this.users = [];
    this.initStore();
  }

  initStore() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.users = JSON.parse(raw);
        if (!Array.isArray(this.users) || this.users.length === 0) {
          this.users = [...SEED_USERS];
          this._persist();
        }
      } else {
        this.users = [...SEED_USERS];
        this._persist();
      }
    } catch (err) {
      console.error('[UserStore] Error loading users, seeding defaults:', err.message);
      this.users = [...SEED_USERS];
      this._persist();
    }
  }

  _persist() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (err) {
      console.error('[UserStore] Failed writing users.json:', err.message);
    }
  }

  findByEmail(email) {
    if (!email) return null;
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  findById(id) {
    if (!id) return null;
    return this.users.find(u => u.id === id) || null;
  }

  validatePassword(plainPassword, passwordHash) {
    if (!plainPassword || !passwordHash) return false;
    return bcrypt.compareSync(plainPassword, passwordHash);
  }

  createUser({ email, password, name, role = 'operator' }) {
    const existing = this.findByEmail(email);
    if (existing) {
      throw new Error(`User with email '${email}' already exists.`);
    }

    const assignedRole = role === 'admin' ? 'admin' : 'operator';
    const newUser = {
      id: `USR-${String(this.users.length + 1).padStart(3, '0')}`,
      email: email.toLowerCase().trim(),
      name: name || email.split('@')[0],
      role: assignedRole,
      passwordHash: bcrypt.hashSync(password, 10),
      created_at: new Date().toISOString()
    };

    this.users.push(newUser);
    this._persist();

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  getAll() {
    return this.users.map(({ passwordHash: _, ...user }) => user);
  }
}

const userStore = new UserStore();
module.exports = userStore;
