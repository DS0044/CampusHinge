import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '../config/env';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  public db: NodePgDatabase | null = null;

  async onModuleInit() {
    try {
      this.pool = new Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
      });

      this.pool.on('error', (err) => {
        // Prevent unhandled pool errors from crashing process during reconnection attempts
        console.warn('Database pool warning:', err.message);
      });

      this.db = drizzle(this.pool);
    } catch (err: any) {
      console.warn('Could not initialize PostgreSQL pool:', err.message);
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }
}
