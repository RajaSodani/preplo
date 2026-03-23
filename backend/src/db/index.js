const knex = require('knex');
const config = require('./knexfile');

// Knex creates a connection pool automatically (default: min 2, max 10) and We export the same instance everywhere — no duplicate pools
const db = knex(config[process.env.NODE_ENV || 'development']);

module.exports = db;
