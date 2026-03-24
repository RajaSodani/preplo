const Joi = require('joi');

// validate(schema) — validates req.body against a Joi schema.
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,    // collect ALL errors, not just the first
    stripUnknown: true,   // silently remove fields not in schema (security)
  });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    return res.status(422).json({ success: false, errors: details });
  }

  req.body = value;  // replace with sanitised value
  next();
};

//  Schemas 
const registerSchema = Joi.object({
  fullName: Joi.string().min(4).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, and a number',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = { validate, registerSchema, loginSchema, refreshSchema };
