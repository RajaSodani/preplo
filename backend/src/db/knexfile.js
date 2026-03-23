require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

module.exports = {
  development: {
    client: 'pg', // PostgreSQL driver for Node
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations_dev',  // table knex uses to track which migrations ran
    },
    seeds: { directory: './seeds' },
  },

  test: {
    client: 'pg',
    connection: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    pool: { min: 1, max: 5 },
    migrations: { directory: './migrations', tableName: 'knex_migrations_test' },
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },  // required for Render/Railway managed PG
    },
    pool: { min: 2, max: 20 },
    migrations: { directory: './migrations', tableName: 'knex_migrations_prod' },
  },
};
