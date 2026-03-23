require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const { connectRedis } = require('./config/redis');
const { connectKafka } = require('./config/kafka');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to Redis before accepting requests
    await connectRedis();
    logger.info('Redis connected');

    // Connect Kafka producer
    await connectKafka();
    logger.info('Kafka producer connected');

    app.listen(PORT, () => {
      logger.info(`Preplo API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown — lets in-flight requests finish before closing
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

startServer();
