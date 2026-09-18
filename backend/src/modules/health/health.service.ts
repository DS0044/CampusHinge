import { Inject, Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { ValkeyService } from '../../valkey/valkey.service';

export interface ReadinessResult {
  isReady: boolean;
  status: 'ready' | 'not_ready';
  timestamp: string;
  services: {
    database: 'ready' | 'down';
    valkey: 'ready' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DrizzleService) private readonly drizzleService: DrizzleService,
    @Inject(ValkeyService) private readonly valkeyService: ValkeyService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    const [dbReady, valkeyReady] = await Promise.all([
      this.drizzleService.isReady(),
      this.valkeyService.isReady(),
    ]);

    const isReady = dbReady && valkeyReady;

    return {
      isReady,
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      services: {
        database: dbReady ? 'ready' : 'down',
        valkey: valkeyReady ? 'ready' : 'down',
      },
    };
  }
}
