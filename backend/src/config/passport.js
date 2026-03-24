const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const db = require('../db');
const logger = require('./logger');

//  JWT ,Used on every protected route. Extracts Bearer token verifies the signature.
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    // issuer: 'preplo.in', // Reject tokens issued before this date (useful after a breach)
  },
  async (payload, done) => {
    try {
      const user = await db('users').where({ id: payload.sub }).first();

      if (!user) return done(null, false);
      // Check if the user's account is banned/suspended — if so, reject auth
      if (user.is_banned) return done(null, false, { message: 'Account suspended' });

      // Attach user to req.user — available in all downstream handlers
      return done(null, user);
    } catch (err) {
      logger.error('JWT strategy error:', err);
      return done(err, false);
    }
  }
));

//  Google OAuth 2.0 , user clicks "Sign in with Google" → Google redirects back
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const googleId = profile.id;

      // Upsert pattern: find by google_id OR email, create if missing
      let user = await db('users')
        .where({ google_id: googleId })
        .orWhere({ email })
        .first();

      if (!user) {
        [user] = await db('users')
          .insert({
            email,
            full_name: profile.displayName,
            google_id: googleId,
            avatar_url: profile.photos?.[0]?.value,
            oauth_provider: 'google',
            plan: 'free',
          })
          .returning('*');

        logger.info(`New user registered via Google: ${email}`);
      } else if (!user.google_id) {
        // Existing email-password user — link their Google account
        [user] = await db('users')
          .where({ id: user.id })
          .update({ google_id: googleId, oauth_provider: 'google' })
          .returning('*');
      }

      return done(null, user);
    } catch (err) {
      logger.error('Google strategy error:', err);
      return done(err, false);
    }
  }
));

module.exports = passport;
