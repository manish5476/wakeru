import Joi from 'joi';

export const verifyFirebaseTokenSchema = Joi.object({
  idToken: Joi.string().required().messages({
    'string.empty': 'Firebase ID token is required',
    'any.required': 'Firebase ID token is required',
  }),
  metadata: Joi.object({
    displayName: Joi.string().min(1).max(100).optional(),
    phoneNumber: Joi.string().optional(),
  }).optional(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required',
  }),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required to log out',
    'any.required': 'Refresh token is required to log out',
  }),
});// import Joi from 'joi';

// export const verifyFirebaseTokenSchema = Joi.object({
//   idToken: Joi.string().required().messages({
//     'string.empty': 'Firebase ID token is required',
//     'any.required': 'Firebase ID token is required'
//   })
// });

// export const refreshTokenSchema = Joi.object({
//   refreshToken: Joi.string().required().messages({
//     'string.empty': 'Refresh token is required',
//     'any.required': 'Refresh token is required'
//   })
// });
