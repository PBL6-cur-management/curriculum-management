import { Module } from '@nestjs/common';
import { IntegrationClientsController } from './integration-clients.controller.js';
import { IntegrationClientsService } from './integration-clients.service.js';

@Module({
  controllers: [IntegrationClientsController],
  providers: [IntegrationClientsService],
})
export class IntegrationClientsModule {}
