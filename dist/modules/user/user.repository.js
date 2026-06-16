"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const user_model_1 = require("./user.model");
class UserRepository {
    async findById(userId) {
        return user_model_1.UserModel.findOne({ userId, isDeleted: false });
    }
    async findByEmail(email) {
        return user_model_1.UserModel.findOne({ email: email.toLowerCase(), isDeleted: false });
    }
    async findByPhone(phoneNumber) {
        return user_model_1.UserModel.findOne({ phoneNumber, isDeleted: false });
    }
    async updateUser(userId, updateData) {
        return user_model_1.UserModel.findOneAndUpdate({ userId, isDeleted: false }, { $set: updateData }, { new: true, runValidators: true });
    }
    async updatePreferences(userId, preferences) {
        return user_model_1.UserModel.findOneAndUpdate({ userId, isDeleted: false }, { $set: { preferences } }, { new: true });
    }
    async updateBankingDetails(userId, bankingDetails) {
        return user_model_1.UserModel.findOneAndUpdate({ userId, isDeleted: false }, { $set: { bankingDetails } }, { new: true });
    }
    async updateProfilePicture(userId, profilePicture) {
        return user_model_1.UserModel.findOneAndUpdate({ userId, isDeleted: false }, { $set: { profilePicture } }, { new: true });
    }
    async softDelete(userId) {
        await user_model_1.UserModel.findOneAndUpdate({ userId }, {
            $set: {
                isDeleted: true,
                isActive: false,
                deletedAt: new Date()
            }
        });
    }
    async deactivateAccount(userId) {
        return user_model_1.UserModel.findOneAndUpdate({ userId }, { $set: { isActive: false } }, { new: true });
    }
    async reactivateAccount(userId) {
        return user_model_1.UserModel.findOneAndUpdate({ userId }, { $set: { isActive: true } }, { new: true });
    }
    async searchUsers(query, limit = 10) {
        const searchRegex = new RegExp(query, 'i');
        return user_model_1.UserModel.find({
            isDeleted: false,
            isActive: true,
            $or: [
                { email: searchRegex },
                { firstName: searchRegex },
                { lastName: searchRegex },
                { displayName: searchRegex },
                { phoneNumber: searchRegex }
            ]
        })
            .select('userId email firstName lastName displayName profilePicture')
            .limit(limit);
    }
    async getUsersByIds(userIds) {
        return user_model_1.UserModel.find({
            userId: { $in: userIds },
            isDeleted: false
        }).select('userId email firstName lastName displayName profilePicture');
    }
    async updateStats(userId, stats) {
        await user_model_1.UserModel.findOneAndUpdate({ userId }, { $set: { stats } });
    }
    async getActiveUsersCount() {
        return user_model_1.UserModel.countDocuments({ isActive: true, isDeleted: false });
    }
    async getUsersByRole(role) {
        return user_model_1.UserModel.find({ role, isDeleted: false, isActive: true });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
//# sourceMappingURL=user.repository.js.map