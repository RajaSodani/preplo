const router = require('express').Router();
const { authenticate, requirePlan } = require('../middleware/authenticate');
const db = require('../db');

// All user routes require authentication
router.use(authenticate);

// GET /api/v1/users/me — full profile
router.get('/me', (req, res) => {
  const { password_hash, refresh_token_hash, ...safeUser } = req.user;
  res.json({ success: true, data: { user: safeUser } });
});

// PATCH /api/v1/users/me — update display name / avatar
router.patch('/me', async (req, res, next) => {
  try {
    const { fullName } = req.body;
    const [updated] = await db('users')
      .where({ id: req.user.id })
      .update({ full_name: fullName, updated_at: new Date() })
      .returning(['id', 'email', 'full_name', 'plan', 'avatar_url']);

    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    next(err);
  }
});

// Example of a plan-gated route (used in Sprint 5)
// router.get('/analytics', requirePlan('pro', 'enterprise'), analyticsController.get);

module.exports = router;
