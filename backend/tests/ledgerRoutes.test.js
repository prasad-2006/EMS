const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const DeductionLedger = require('../models/DeductionLedger');

jest.setTimeout(30000);
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod && typeof mongod.stop === 'function') await mongod.stop();
});

describe.skip('ledgerRoutes (admin protected)', () => {
  let adminToken;
  beforeEach(async () => {
    await User.deleteMany({});
    const admin = await User.create({ name: 'Admin', email: 'a@x.com', password: 'pass', role: 'admin' });
    // create a JWT token similarly to auth flow
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'testsecret';
    adminToken = jwt.sign({ id: admin._id }, secret);
  });

  test('GET /api/ledger should require auth', async () => {
    const res = await request(app).get('/api/ledger');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/ledger allowed for admin', async () => {
    const res = await request(app).get('/api/ledger').set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });
});
