const logger = require('../config/logger');

/**
 * Global error handler — must be registered LAST in app.js.
 * Express recognises it as an error handler because it takes 4 args (err, req, res, next).
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error internally
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500
      ? 'Something went wrong. Please try again.'
      : err.message,
    // Only include error code in development for easier debugging
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler — catches requests to routes that don't exist.
 * Must be registered AFTER all routes, BEFORE errorHandler.
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
};

module.exports = { errorHandler, notFound };
