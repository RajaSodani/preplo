const rateLimit = require('express-rate-limit');

/**
 * Global limiter — applied to all /api routes.
 * 100 requests per 10 minutes per IP.
 */
const LIMITED_MINUTES = 10;
const LIMITED_REQUESTS = 100;

const globalRateLimiter = rateLimit({
  windowMs: LIMITED_MINUTES * 60 * 1000,
  max: LIMITED_REQUESTS,
  standardHeaders: true,   // sends RateLimit-* headers so clients know their quota
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

/**
 * Strict limiter for auth endpoints to prevents brute-force attacks.
 * 10 attempts per 10 minutes per IP.
 */
const authRateLimiter = rateLimit({
  windowMs: LIMITED_MINUTES * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: `Too many login attempts. Try again in ${LIMITED_MINUTES} minutes.` },
});

module.exports = { globalRateLimiter, authRateLimiter };
