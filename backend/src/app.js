const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const passport = require('passport');

const { globalRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const jdRoutes = require('./routes/jd.routes');

// Passport strategies must be required to register themselves
require('./config/passport');

const app = express();

// Security headers 
app.use(helmet());

//  CORS, Only allow requests from frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

//  Body parsing 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(compression());

//  HTTP request logging ─
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(passport.initialize());

//  Rate limiting 
app.use('/api', globalRateLimiter);

//  Health check (no auth needed — used by load balancers)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

//  API routes 
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jd', jdRoutes);

//  404 + global error handler (always at last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
