import Joi from 'joi';

export const verifyFirebaseTokenSchema = Joi.object({
  idToken: Joi.string().required().messages({
    'string.empty': 'Firebase ID token is required',
    'any.required': 'Firebase ID token is required'
  })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required'
  })
});