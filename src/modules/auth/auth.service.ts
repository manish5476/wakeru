import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import jwt from 'jsonwebtoken';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET and JWT_REFRESH_SECRET are not defined.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

const generateTokens = async (user: IUser) => {
  const accessTokenPayload = { userId: user.userId, role: user.role };
  const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION as any });

  const refreshTokenPayload = { userId: user.userId };
  const refreshToken = jwt.sign(refreshTokenPayload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION as any });

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  return {
    accessToken,
    refreshToken
  };
};

export const AuthService = {
  async register(idToken: string, metadata?: any): Promise<{ user: IUser, tokens: any }> {
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email;

      if (!email) {
        throw new AppError(400, 'Firebase token does not contain an email');
      }

      let user = await User.findOne({ email });

      if (user) {
        throw new AppError(409, 'User already exists. Please login.');
      }

      // Create new user
      user = new User({
        userId: uuidv4(),
        firebaseUid,
        email,
        displayName: metadata?.displayName || decodedToken.name || 'User',
        profilePictureUrl: decodedToken.picture || '',
        phoneNumber: metadata?.phoneNumber || '',
      });
      await user.save();

      const tokens = await generateTokens(user);
      return { user, tokens };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Invalid Firebase ID token or registration failed');
    }
  },

  async login(idToken: string): Promise<{ user: IUser, tokens: any }> {
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      
      // We look up by firebaseUid. If they signed up with a different provider, 
      // they need to link it. For simplicity, we just find by firebaseUid or email.
      let user = await User.findOne({ firebaseUid });
      
      if (!user && decodedToken.email) {
          user = await User.findOne({ email: decodedToken.email });
          if (user) {
              // Auto-link if email matches exactly
              user.firebaseUid = firebaseUid;
              await user.save();
          }
      }

      if (!user) {
        throw new AppError(404, 'User not found. Please register first.');
      }

      const tokens = await generateTokens(user);
      return { user, tokens };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Invalid Firebase ID token');
    }
  },
  
  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      const user = await User.findOne({ userId: decoded.userId });

      if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
        throw new AppError(401, 'Invalid refresh token');
      }

      // Refresh token rotation: remove the old token
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);

      const newTokens = await generateTokens(user);
      return newTokens;

    } catch (error) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }
  },
  
  async logout(userId: string, refreshToken: string): Promise<void> {
      const user = await User.findOne({ userId });
      if (user && user.refreshTokens) {
          user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
          await user.save({ validateBeforeSave: false });
      }
  }
};