// Models
export { User, IUser, IUserPreferences } from './auth.model';

// Services
export { AuthService } from './auth.service';

// Controllers
export { authController, AuthController } from './auth.controller';

// Routes
export { authRoutes } from './auth.routes';

// Middleware
export { protect, authorize, optionalAuth, AuthMiddleware } from './auth.middleware';
export type { JwtPayload } from './auth.middleware';

// Validation
export * from './auth.validation';