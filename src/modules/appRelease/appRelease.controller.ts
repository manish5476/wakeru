import { Request, Response, NextFunction } from 'express';
import { AppRelease } from './appRelease.model';
import { notificationService } from '../notification/notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { AppError } from '../../shared/errors/AppError';

export class AppReleaseController {
  /**
   * GET /api/v1/app-release/latest
   * Public endpoint: retrieve the latest active release for a platform (default 'android')
   */
  static async getLatestRelease(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const platform = (req.query.platform as string) || 'android';

      let release = await AppRelease.findOne({
        platform,
        isActive: true,
      })
        .sort({ releasedAt: -1, createdAt: -1 })
        .lean();

      // Graceful fallback to default configuration if database is empty
      if (!release) {
        release = {
          platform: 'android',
          version: '2.1.0',
          buildNumber: 21,
          downloadUrl: 'https://github.com/wakeru-app/releases/releases/latest/download/TripSplit.apk',
          displayLabel: 'TripSplit Android APK (v2.1.0)',
          releaseNotes: 'Performance enhancements, multi-currency live FX engine, and instant 1-tap settlement.',
          isActive: true,
          forceUpdate: false,
          minSupportedVersion: '1.0.0',
          releasedAt: new Date(),
        } as any;
      }

      res.status(200).json({
        success: true,
        data: release,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/app-release/admin/all
   * Admin-only: list all release entries
   */
  static async listAllReleases(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const releases = await AppRelease.find().sort({ releasedAt: -1, createdAt: -1 }).lean();
      res.status(200).json({
        success: true,
        data: releases,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/app-release/admin/publish
   * Admin-only: create or update an active release, with optional user notification broadcast
   */
  static async publishRelease(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        throw new AppError('Admin permission required', 403);
      }

      const {
        platform = 'android',
        version,
        buildNumber,
        downloadUrl,
        displayLabel,
        releaseNotes,
        isActive = true,
        forceUpdate = false,
        broadcastNotification = false,
      } = req.body;

      if (!downloadUrl || !version) {
        throw new AppError('downloadUrl and version are required', 400);
      }

      // If set to active, deactivate previous releases for this platform
      if (isActive) {
        await AppRelease.updateMany({ platform }, { $set: { isActive: false } });
      }

      const release = await AppRelease.create({
        platform,
        version,
        buildNumber: buildNumber || 1,
        downloadUrl,
        displayLabel: displayLabel || `TripSplit ${platform.toUpperCase()} (${version})`,
        releaseNotes: releaseNotes || '',
        isActive: !!isActive,
        forceUpdate: !!forceUpdate,
        releasedAt: new Date(),
      });

      // Unified Notification: If requested, broadcast to all users and websockets
      if (broadcastNotification && isActive) {
        const title = `🚀 TripSplit ${version} Released!`;
        const message = releaseNotes || `Download the latest ${platform.toUpperCase()} release of TripSplit with upgraded travel split features.`;

        socketServer.broadcastToAll('app:update_broadcast', {
          type: 'APP_UPDATE',
          version,
          title,
          message,
          link: downloadUrl,
          forceUpdate: !!forceUpdate,
          timestamp: new Date().toISOString(),
        });

        await notificationService.broadcastSystemUpdate(title, message, downloadUrl);
      }

      res.status(201).json({
        success: true,
        message: 'Release published successfully',
        data: release,
      });
    } catch (err) {
      next(err);
    }
  }
}
