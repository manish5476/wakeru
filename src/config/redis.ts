import Redis, { RedisOptions } from 'ioredis';
import { config } from './index';
import { logger } from './logger';

// ============================================================
// REDIS CONNECTION CONFIGURATION
//
// Three connection methods are documented below.
// Currently ACTIVE: Method 1 — Redis Cloud (managed hosted Redis)
//
// To switch methods:
//   1. Comment out the active method block
//   2. Uncomment the desired method block
//   3. Update your .env file accordingly
//   4. Restart the server
// ============================================================

// ────────────────────────────────────────────────────────────
// METHOD 1: REDIS CLOUD (Active — Default)
// ────────────────────────────────────────────────────────────
// Managed, hosted Redis. No local installation needed.
// Best for: production, staging, remote dev environments
//
// Setup steps:
//   1. Visit https://redis.io/try-free and create a free account
//   2. Create a free database (30 MB free tier)
//   3. Copy your connection URL from the dashboard
//   4. Add to .env:
//        REDIS_URL=redis://default:<password>@<host>.redis.cloud:<port>
//        REDIS_PASSWORD=<your_password>
//
// Example .env values:
//   REDIS_URL=redis://default:abc123@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
//   REDIS_PASSWORD=abc123
// ────────────────────────────────────────────────────────────
function createRedisCloudOptions(): RedisOptions {
  return {
    password: config.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('[Redis Cloud] Retry limit exceeded. Giving up.');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`[Redis Cloud] Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    tls: config.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  };
}

// ────────────────────────────────────────────────────────────
// METHOD 2: DOCKER (Commented Out)
// ────────────────────────────────────────────────────────────
// Run Redis locally via Docker. No installation needed beyond Docker Desktop.
// Best for: local development, CI/CD pipelines
//
// Setup steps:
//   1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
//   2. Run: docker run -d --name redis-wakeru -p 6379:6379 redis:alpine
//   3. Add to .env:
//        REDIS_URL=redis://localhost:6379
//        # REDIS_PASSWORD=  (leave blank — default Docker Redis has no password)
//
// Stop Redis:   docker stop redis-wakeru
// Start again:  docker start redis-wakeru
// Remove:       docker rm redis-wakeru
//
// function createDockerRedisOptions(): RedisOptions {
//   return {
//     host: 'localhost',
//     port: 6379,
//     password: config.REDIS_PASSWORD || undefined,
//     retryStrategy: (times: number) => {
//       if (times > 5) {
//         logger.error('[Redis Docker] Is the container running? Check: docker ps');
//         return null;
//       }
//       return Math.min(times * 300, 3000);
//     },
//     maxRetriesPerRequest: 3,
//     enableReadyCheck: true,
//     lazyConnect: true,
//   };
// }
//
// To activate: replace createRedisCloudOptions() calls below with createDockerRedisOptions()
// and set REDIS_URL=redis://localhost:6379 in .env
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// METHOD 3: WINDOWS LOCAL REDIS (Commented Out)
// ────────────────────────────────────────────────────────────
// Run Redis natively on Windows (via Memurai — a Windows-native Redis port).
// Best for: Windows development without Docker
//
// Setup steps:
//   Option A — Memurai (Recommended, Redis-compatible):
//     1. Download from https://www.memurai.com/get-memurai
//     2. Install and run. Memurai starts automatically as a Windows service.
//     3. Add to .env:
//          REDIS_URL=redis://localhost:6379
//
//   Option B — WSL2 Redis:
//     1. Install WSL2: wsl --install
//     2. Open Ubuntu terminal: sudo apt update && sudo apt install redis
//     3. Start: sudo service redis-server start
//     4. Add to .env:
//          REDIS_URL=redis://localhost:6379
//
// function createWindowsLocalRedisOptions(): RedisOptions {
//   return {
//     host: '127.0.0.1',
//     port: 6379,
//     retryStrategy: (times: number) => {
//       if (times > 5) {
//         logger.error('[Redis Local] Not running? Start Memurai or WSL2 Redis.');
//         return null;
//       }
//       return Math.min(times * 200, 2000);
//     },
//     maxRetriesPerRequest: 3,
//     enableReadyCheck: true,
//     lazyConnect: true,
//   };
// }
//
// To activate: replace createRedisCloudOptions() calls below with createWindowsLocalRedisOptions()
// and set REDIS_URL=redis://127.0.0.1:6379 in .env
// ────────────────────────────────────────────────────────────

// ============================================================
// REDIS CLIENT CLASS
// ============================================================

export class RedisClient {
  private static instance: RedisClient;
  public client: Redis;
  public subscriber: Redis;
  public publisher: Redis;
  private isConnected: boolean = false;

  private constructor() {
    // ── Active Method: Redis Cloud ──
    // Switch createRedisCloudOptions() to another method if needed.
    const options = createRedisCloudOptions();

    this.client = new Redis(config.REDIS_URL, options);
    this.subscriber = new Redis(config.REDIS_URL, options);
    this.publisher = new Redis(config.REDIS_URL, options);

    this.setupEventHandlers();
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('✅ Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('⚡ Redis client ready — cache is live');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.warn(`Redis error (non-fatal — server continues): ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  async connect(): Promise<void> {
    if (!config.REDIS_URL || config.REDIS_URL === 'redis://localhost:6379') {
      logger.warn('⚠️  Redis: No REDIS_URL set in .env — running without Redis cache.');
      logger.warn('   → Idempotency middleware and caching will be silently skipped.');
      logger.warn('   → To enable: add REDIS_URL to .env and restart.');
      return;
    }

    try {
      await this.client.connect();
      await this.subscriber.connect();
      await this.publisher.connect();
      logger.info('✅ Redis fully connected (client + subscriber + publisher)');
    } catch (error: any) {
      // Non-fatal: server continues without cache
      logger.warn(`⚠️  Redis connection failed — server running without cache: ${error.message}`);
    }
  }

  // ── Cache Helpers ──────────────────────────────────────────

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      logger.warn(`Redis SET failed for key "${key}": ${err.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (err: any) {
      logger.warn(`Redis GET failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      logger.warn(`Redis DEL failed for key "${key}": ${err.message}`);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err: any) {
      logger.warn(`Redis deletePattern failed for "${pattern}": ${err.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      return (await this.client.exists(key)) === 1;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      await this.subscriber.quit();
      await this.publisher.quit();
      logger.info('Redis disconnected gracefully');
    } catch (err: any) {
      logger.warn(`Redis disconnect error: ${err.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisClient = RedisClient.getInstance();