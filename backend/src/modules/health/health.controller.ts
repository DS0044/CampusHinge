import { Controller, Get, Inject, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get()
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res() res: FastifyReply) {
    const result = await this.healthService.getReadiness();
    const statusCode = result.isReady ? 200 : 503;
    res.status(statusCode).send({
      status: result.status,
      timestamp: result.timestamp,
      services: result.services,
    });
  }
}
