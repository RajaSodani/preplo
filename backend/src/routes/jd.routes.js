const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const jdController = require('../controllers/jd.controller');
const Joi = require('joi');

const submitSchema = Joi.object({
  jdText: Joi.string().min(50).max(20000).required().messages({
    'string.min': 'JD is too short — paste the full job description',
    'string.max': 'JD is way too long — something seems off',
  }),
});

router.use(authenticate); // all JD routes need auth

router.post('/',validate(submitSchema), jdController.submit);
router.get('/', jdController.listMine);
router.get('/:jdId', jdController.getAnalysis);
router.get('/:jdId/prep-kit', jdController.getStatus);

module.exports = router;
