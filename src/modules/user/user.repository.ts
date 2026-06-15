import { UserModel, IUserDocument } from './user.model';
import { UpdateUserDTO } from '../../shared/types/user.types';
import { Types } from 'mongoose';

export class UserRepository {
  async findById(userId: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ userId, isDeleted: false });
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase(), isDeleted: false });
  }

  async findByPhone(phoneNumber: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ phoneNumber, isDeleted: false });
  }

  async updateUser(userId: string, updateData: UpdateUserDTO): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      { userId, isDeleted: false },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async updatePreferences(userId: string, preferences: any): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      { userId, isDeleted: false },
      { $set: { preferences } },
      { new: true }
    );
  }

  async updateBankingDetails(userId: string, bankingDetails: any): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      { userId, isDeleted: false },
      { $set: { bankingDetails } },
      { new: true }
    );
  }

  async updateProfilePicture(userId: string, profilePicture: string): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      { userId, isDeleted: false },
      { $set: { profilePicture } },
      { new: true }
    );
  }

  async softDelete(userId: string): Promise<void> {
    await UserModel.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          isDeleted: true, 
          isActive: false,
          deletedAt: new Date()
        } 
      }
    );
  }

  async deactivateAccount(userId: string): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      { userId },
      { $set: { isActive: false } },
      { new: true }
    );
  }

  async reactivateAccount(userId: string): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      { userId },
      { $set: { isActive: true } },
      { new: true }
    );
  }

  async searchUsers(query: string, limit: number = 10): Promise<IUserDocument[]> {
    const searchRegex = new RegExp(query, 'i');
    return UserModel.find({
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

  async getUsersByIds(userIds: string[]): Promise<IUserDocument[]> {
    return UserModel.find({
      userId: { $in: userIds },
      isDeleted: false
    }).select('userId email firstName lastName displayName profilePicture');
  }

  async updateStats(userId: string, stats: Partial<IUserDocument['stats']>): Promise<void> {
    await UserModel.findOneAndUpdate(
      { userId },
      { $set: { stats } }
    );
  }

  async getActiveUsersCount(): Promise<number> {
    return UserModel.countDocuments({ isActive: true, isDeleted: false });
  }

  async getUsersByRole(role: string): Promise<IUserDocument[]> {
    return UserModel.find({ role, isDeleted: false, isActive: true });
  }
}

export const userRepository = new UserRepository();