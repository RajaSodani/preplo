const { Kafka, Partitioners, logLevel } = require('kafkajs');
const logger = require('./logger');

const TOPICS = {
  JD_SUBMITTED: 'jd.submitted',
  RESUME_UPLOADED: 'resume.uploaded',
  INTERVIEW_COMPLETED: 'interview.completed',
  NOTIF_SEND: 'notif.send',
  BILLING_EVENT: 'billing.event',
  DLQ: 'preplo.dlq', // Dead-letter queue — failed messages land here for inspection
  // Add more topics as needed
};

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'preplo-backend',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  // Map KafkaJS to Winston log levels 
  logCreator: () => ({ namespace, level, label, log }) => {
    const { message } = log;
    if (level <= logLevel.ERROR) logger.error(`[Kafka:${namespace}] ${message}`);
    else if (level <= logLevel.WARN) logger.warn(`[Kafka:${namespace}] ${message}`);
    else logger.debug(`[Kafka:${namespace}] ${message}`);
  },
});

// Single producer instance — reused for all publishes
let producer;

async function connectKafka() {
  producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });
  await producer.connect();
  logger.info('Kafka producer connected');
  return producer;
}

function getProducer() {
  if (!producer) throw new Error('Kafka producer not initialised.');
  return producer;
}

/**
 * Publish a single event to a Kafka topic.
 * Always serialises value to JSON string.
 *
 * @param {string} topic  - use TOPICS constants
 * @param {object} payload
 * @param {string} [key]  - partition key (e.g. user_id keeps user events ordered)
 */
async function publishEvent(topic, payload, key) {
  await getProducer().send({
    topic,
    messages: [{
      key: key ? String(key) : null,
      value: JSON.stringify({
        ...payload,
        _meta: { publishedAt: new Date().toISOString() },
      }),
    }],
  });
}

module.exports = { kafka, connectKafka, getProducer, publishEvent, TOPICS };
