const passport = require('passport');

/**
 * authenticate middleware — protects any route that needs a logged-in user.
 * On success:  sets req.user and calls next()
 * On failure:  returns 401 JSON (session: false means no session cookie)
 */
const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || 'Authentication required',
      });
    }
    // set req.user for downstream handlers (e.g. controllers) to access user info without re-querying the DB
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * requirePlan middleware — plan-based feature gating.
 * Call after authenticate.
 * Usage:
 *   router.post('/analyse', authenticate, requirePlan('pro'), controller.analyse);
 */
const requirePlan = (...allowedPlans) => (req, res, next) => {
  if (!allowedPlans.includes(req?.user?.plan)) {
    return res.status(403).json({
      success: false,
      message: `This feature requires a ${allowedPlans.join(' or ')} plan.`,
      upgradeUrl: '/pricing',
    });
  }
  next();
};

module.exports = { authenticate, requirePlan };
