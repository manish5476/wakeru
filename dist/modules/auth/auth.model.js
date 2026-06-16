"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    displayName: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    phoneNumber: { type: String, index: true },
    profilePictureUrl: { type: String },
    bio: { type: String },
    upiId: { type: String },
    preferences: { type: Map, of: mongoose_1.Schema.Types.Mixed, default: {} },
    refreshTokens: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false
});
// Securely serialize user data
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.refreshTokens;
        return ret;
    },
});
exports.User = (0, mongoose_1.model)('User', userSchema);
//# sourceMappingURL=auth.model.js.map