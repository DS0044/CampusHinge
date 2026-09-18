import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { HealthService } from '../src/modules/health/health.service';
import { DrizzleService } from '../src/database/drizzle.service';
import { ValkeyService } from '../src/valkey/valkey.service';

describe('Health Module (Liveness & Readiness)', () => {
  let app: NestFastifyApplication;
  let healthService: HealthService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    healthService = moduleRef.get<HealthService>(HealthService);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Liveness Probe (GET /health)', () => {
    it('returns 200 with status: "ok" and timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('Readiness Probe (GET /health/ready)', () => {
    it('returns structured readiness object with status and services breakdown', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      // Depending on whether local Postgres/Valkey are online, statusCode is 200 or 503
      expect([200, 503]).toContain(response.statusCode);

      const body = JSON.parse(response.body);
      expect(['ready', 'not_ready']).toContain(body.status);
      expect(body.timestamp).toBeDefined();
      expect(body.services).toBeDefined();
      expect(['ready', 'down']).toContain(body.services.database);
      expect(['ready', 'down']).toContain(body.services.valkey);
    });

    it('returns status: "ready" and 200 when all services are healthy', async () => {
      const mockDrizzle = { isReady: async () => true } as DrizzleService;
      const mockValkey = { isReady: async () => true } as ValkeyService;
      const customHealthService = new HealthService(mockDrizzle, mockValkey);

      const result = await customHealthService.getReadiness();
      expect(result.isReady).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.services.database).toBe('ready');
      expect(result.services.valkey).toBe('ready');
    });

    it('returns status: "not_ready" and false when a service is down', async () => {
      const mockDrizzle = { isReady: async () => false } as DrizzleService;
      const mockValkey = { isReady: async () => true } as ValkeyService;
      const customHealthService = new HealthService(mockDrizzle, mockValkey);

      const result = await customHealthService.getReadiness();
      expect(result.isReady).toBe(false);
      expect(result.status).toBe('not_ready');
      expect(result.services.database).toBe('down');
      expect(result.services.valkey).toBe('ready');
    });
  });
});
