import { Module } from '@nestjs/common';
import { MajorsController } from './majors.controller.js';
import { MajorsService } from './majors.service.js';

@Module({
  controllers: [MajorsController],
  providers: [MajorsService],
  exports: [MajorsService],
})
export class MajorsModule {}
