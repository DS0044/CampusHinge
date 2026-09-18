import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ValkeyModule } from './valkey/valkey.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    DatabaseModule,
    ValkeyModule,
    HealthModule,
  ],
})
export class AppModule {}
