import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class ValkeyService implements OnModuleInit, OnModuleDestroy {
  public client: Redis | null = null;

  async onModuleInit() {
    try {
      this.client = new Redis(env.VALKEY_URL, {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) return null; // Stop retrying if not available locally
          return Math.min(times * 100, 1000);
        },
      });

      this.client.on('error', (err) => {
        // Prevent uncaught Redis errors from crashing the process
        console.warn('Valkey connection notice:', err.message);
      });

      await this.client.connect().catch(() => {
        // Safe to ignore in development if Valkey daemon is not running
      });
    } catch (err: any) {
      console.warn('Could not initialize Valkey client:', err.message);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }
}
