"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const userSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    phoneNumber: { type: String },
    profilePictureUrl: { type: String },
    bio: { type: String },
    authProviders: {
        google: { id: { type: String } },
        apple: { id: { type: String } },
    },
    preferences: { type: Map, of: mongoose_1.Schema.Types.Mixed },
    refreshTokens: [{ type: String }],
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false
});
// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcryptjs_1.default.genSalt(10);
    this.password = await bcryptjs_1.default.hash(this.password, salt);
    next();
});
// Method to compare entered password with the hashed password
userSchema.methods.comparePassword = async function (password) {
    return bcryptjs_1.default.compare(password, this.password || '');
};
// Method to generate email verification token
userSchema.methods.generateVerificationToken = function () {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
    this.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return token;
};
// Securely serialize user data
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        return ret;
    },
});
exports.User = (0, mongoose_1.model)('User', userSchema);
//# sourceMappingURL=auth.model.js.map