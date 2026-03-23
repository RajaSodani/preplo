const { createClient } = require('redis');
const logger = require('./logger');

let client;

async function connectRedis() {
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6380' });

  client.on('error', (err) => logger.error('Redis error:', err));
  client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await client.connect();
  return client;
}

// Getter, so other modules always get the connected instance, and no duplicate connections are created.
function getRedisClient() {
  if (!client) throw new Error('Redis not initialised. Call connectRedis() first.');
  return client;
}

module.exports = { connectRedis, getRedisClient };
