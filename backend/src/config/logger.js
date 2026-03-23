const { createLogger, format, transports } = require('winston');

// In production ship these logs to Datadog / CloudWatch.
// In development, pretty-print with colours.
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),  // includes stack trace on Error objects
    format.json()
  ),
  defaultMeta: { service: 'preplo-api' },
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    }),
  ],
});

module.exports = logger;
