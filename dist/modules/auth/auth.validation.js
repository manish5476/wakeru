"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.verifyFirebaseTokenSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.verifyFirebaseTokenSchema = joi_1.default.object({
    idToken: joi_1.default.string().required().messages({
        'string.empty': 'Firebase ID token is required',
        'any.required': 'Firebase ID token is required'
    })
});
exports.refreshTokenSchema = joi_1.default.object({
    refreshToken: joi_1.default.string().required().messages({
        'string.empty': 'Refresh token is required',
        'any.required': 'Refresh token is required'
    })
});
//# sourceMappingURL=auth.validation.js.map