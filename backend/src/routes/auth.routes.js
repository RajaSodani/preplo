const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/authenticate');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema, loginSchema, refreshSchema } = require('../middleware/validate');

//  Email / Password 
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login',    authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema),   authController.refresh);
router.post('/logout',   authenticate, authController.logout);

//  Google OAuth 
// Step 1: redirect user to Google's consent screen
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2: Google redirects back here with a code; Passport exchanges it for a profile
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  authController.googleCallback
);

//  Verify token (useful for frontend on page load) 
router.get('/me', authenticate, (req, res) => {
  const { password_hash, refresh_token_hash, ...safeUser } = req.user;
  res.json({ success: true, data: { user: safeUser } });
});

module.exports = router;
