const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const logger = require('../config/logger');

const BCRYPT_ROUNDS = 12;  // cost factor: higher becuase of slower hash but harder to brute-force


function signTokens(userId) {
  // Access tokens are sent with every API request.
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Refresh tokens are used to get a new access token when it expires.
  const refreshToken = jwt.sign(
    { sub: userId, jti: uuidv4(), type: 'refresh' }, // jti = unique ID per token
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Register with email + password.
 * Bcrypt Password
 */
async function register({ email, password, full_name }) {
  const existing = await db('users').where({ email }).first();
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409; // conflict with existing resource
    throw err;
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db('users')
    .insert({ email, full_name, password: password_hash, plan: 'free' })
    .returning(['id', 'email', 'full_name', 'plan', 'created_at']);

  const tokens = signTokens(user.id);

  // Store hashed refresh token so that, raw tokens aren't exposed on attack
  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  await db('users').where({ id: user.id }).update({ refresh_token: refreshHash });

  logger.info(`User registered: ${email}`);
  return { user, ...tokens };
}

/**
 * Login with email + password.
 * bcrypt.compare is timing-safe (prevents timing attacks).
 */
async function login({ email, entered_password }) {
  const user = await db('users').where({ email }).first();

  // Deliberate: same error for "user not found" and "wrong password" so attackers cannot enumerate credentials.

  if (!user || !user.password) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(entered_password, user.password);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (user.is_banned) {
    const err = new Error('Account suspended');
    err.statusCode = 403;
    throw err;
  }

  const tokens = signTokens(user.id);
  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  await db('users').where({ id: user.id }).update({ refresh_token: refreshHash });

  const { password, refresh_token, ...safeUser } = user;
  return { user: safeUser, ...tokens };
}

/**
 * Exchange a valid refresh token for a new access token.
 */
async function refreshAccessToken(incomingRefreshToken) {
  let payload;
  try {
    payload = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  if (payload.type !== 'refresh') {
    const err = new Error('Wrong token type');
    err.statusCode = 401;
    throw err;
  }

  const user = await db('users').where({ id: payload.sub }).first();
  if (!user || !user.refresh_token) {
    const err = new Error('Token revoked');
    err.statusCode = 401;
    throw err;
  }

  const match = await bcrypt.compare(incomingRefreshToken, user.refresh_token);
  if (!match) {
    // Possible token reuse attack — revoke all tokens for this user
    await db('users').where({ id: user.id }).update({ refresh_token: null });
    const err = new Error('Token reuse detected. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  const tokens = signTokens(user.id);
  const newRefreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  await db('users').where({ id: user.id }).update({ refresh_token: newRefreshHash });

  return tokens;
}

/**
 * Logout — wipe the stored refresh token hash so it can never be reused.
 */
async function logout(userId) {
  await db('users').where({ id: userId }).update({ refresh_token: null });
}

/**
 * Called after Google OAuth success — issue our own JWT pair.
 */
async function handleOAuthSuccess(user) {
  const tokens = signTokens(user.id);
  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  await db('users').where({ id: user.id }).update({ refresh_token: refreshHash });
  return tokens;
}

module.exports = { register, login, refreshAccessToken, logout, handleOAuthSuccess };
