const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

// Clean the users table before each test so tests are isolated
beforeEach(async () => {
  await db('users').del();
});

// Close DB pool after all tests — prevents Jest from hanging
afterAll(async () => {
  await db.destroy();
});

describe('POST /api/v1/auth/register', () => {
  const validPayload = {
    fullName: 'Arjun Sharma',
    email: 'arjun@example.com',
    password: 'Password1',
  };

  it('creates a user and returns access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('arjun@example.com');
    // Password must never appear in the response
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('returns 409 when email already registered', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(409);
  });

  it('returns 422 when password is too weak', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, password: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      fullName: 'Arjun Sharma',
      email: 'arjun@example.com',
      password: 'Password1',
    });
  });

  it('returns tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'arjun@example.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'arjun@example.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns user when valid token provided', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Arjun Sharma',
      email: 'arjun@example.com',
      password: 'Password1',
    });

    const { accessToken } = reg.body.data;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('arjun@example.com');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
