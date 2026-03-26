require('dotenv').config();
const { connectKafka, publishEvent } = require('../config/kafka');
const db = require('../db');
const logger = require('../config/logger');

// the outbox relay picks up events that were written to kafka_events
// but not yet published to Kafka (e.g. if Kafka was down at the time)

// runs every 5 seconds — simple polling, not the most elegant but reliable
// could replace with pg_notify for instant triggering, but polling is fine at our scale

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 50; // process 50 events at a time max

async function processOneBatch() {
  const events = await db('kafka_events')
    .where({ status: 'pending' })
    .orderBy('created_at', 'asc')
    .limit(BATCH_SIZE);

  if (events.length === 0) return;

  logger.debug(`Outbox relay: processing ${events.length} pending events`);

  for (const event of events) {
    try {
      await publishEvent(event.topic, JSON.parse(event.payload), event.partition_key);

      await db('kafka_events').where({ id: event.id }).update({
        status: 'published',
        published_at: new Date(),
      });
    } catch (err) {
      logger.error(`Failed to publish event ${event.id}:`, err.message);

      await db('kafka_events').where({ id: event.id }).update({
        retry_count: db.raw('retry_count + 1'),
        last_error: err.message,
        // after 5 retries give up — prevents infinite loops on permanently bad events
        status: db.raw("CASE WHEN retry_count >= 4 THEN 'failed' ELSE 'pending' END"),
      });
    }
  }
}

async function run() {
  await connectKafka();
  logger.info('Outbox relay started');

  // just run forever
  while (true) {
    try {
      await processOneBatch();
    } catch (err) {
      // catch unexpected errors so the loop doesn't die
      logger.error('Outbox relay batch error:', err);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

run().catch((err) => {
  logger.error('Outbox relay crashed:', err);
  process.exit(1);
});
