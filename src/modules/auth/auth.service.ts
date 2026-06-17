import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import jwt from 'jsonwebtoken';
import { getAuth } from 'firebase-admin/auth';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';
const MAX_REFRESH_TOKENS_PER_USER = 5;

const generateTokens = async (user: IUser) => {
  const accessTokenPayload = { userId: user.userId, role: user.role, type: 'access' };
  const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRATION as any,
  });

  const refreshTokenPayload = { userId: user.userId, type: 'refresh' };
  const refreshToken = jwt.sign(refreshTokenPayload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRATION as any,
  });

  // CRITICAL FIX: Atomic update limits the array size to MAX_REFRESH_TOKENS_PER_USER
  // directly in the database. Zero race conditions.
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          $each: [refreshToken],
          $slice: -MAX_REFRESH_TOKENS_PER_USER,
        },
      },
    }
  );

  return { accessToken, refreshToken };
};

export const AuthService = {
  async register(idToken: string, metadata?: any) {
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      throw new AppError(401, 'Invalid or expired Firebase ID token');
    }

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) throw new AppError(400, 'Firebase token does not contain an email');

    const existing = await User.findOne({ $or: [{ email }, { firebaseUid }] }).lean();
    if (existing) {
      throw new AppError(409, 'User already exists. Please login.');
    }

    const user = new User({
      userId: uuidv4(),
      firebaseUid,
      email,
      displayName: metadata?.displayName || decodedToken.name || 'User',
      profilePictureUrl: decodedToken.picture || '',
      phoneNumber: metadata?.phoneNumber || '',
    });

    try {
      await user.save();
    } catch (err: any) {
      if (err.code === 11000) throw new AppError(409, 'User already exists. Please login.');
      throw err;
    }

    const tokens = await generateTokens(user);
    return { user, tokens };
  },

  async login(idToken: string) {
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      throw new AppError(401, 'Invalid or expired Firebase ID token');
    }

    const firebaseUid = decodedToken.uid;
    let user = await User.findOne({ firebaseUid });

    if (!user && decodedToken.email) {
      if (!decodedToken.email_verified) {
        throw new AppError(404, 'User not found. Please register first.');
      }
      user = await User.findOne({ email: decodedToken.email });
      if (user) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
    }

    if (!user) throw new AppError(404, 'User not found. Please register first.');
    if (user.isDeleted) throw new AppError(403, 'This account has been deleted');
    if (!user.isActive) throw new AppError(403, 'This account has been deactivated');

    const tokens = await generateTokens(user);
    return { user, tokens };
  },

  async refreshToken(oldRefreshToken: string) {
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(oldRefreshToken, JWT_REFRESH_SECRET) as { userId: string };
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    // CRITICAL FIX: Atomically remove the old token. 
    // If modifiedCount is 0, the token wasn't in the array (already used or invalid).
    const result = await User.updateOne(
      { userId: decoded.userId, refreshTokens: oldRefreshToken },
      { $pull: { refreshTokens: oldRefreshToken } }
    );

    if (result.modifiedCount === 0) {
      throw new AppError(401, 'Invalid or already consumed refresh token');
    }

    const user = await User.findOne({ userId: decoded.userId });
    if (!user || user.isDeleted || !user.isActive) {
      throw new AppError(403, 'Account is no longer active');
    }

    return await generateTokens(user);
  },

  async logout(userId: string, refreshToken: string) {
    // Atomically pull the token. No need to load the user document first.
    await User.updateOne(
      { userId },
      { $pull: { refreshTokens: refreshToken } }
    );
  },
};
