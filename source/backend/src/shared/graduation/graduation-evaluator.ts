import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { GraduationReaderCapability } from './graduation-capability.js';
import { GraduationInputReader } from './graduation-input.reader.js';
import { graduationInputDigest } from './graduation-input.codec.js';
import { evaluateGraduation } from './graduation-engine.js';

@Injectable()
export class GraduationEvaluator {
  constructor(private readonly inputs: GraduationInputReader) {}
  async evaluate(
    capability: GraduationReaderCapability,
    tx: Prisma.TransactionClient,
  ) {
    const input = await this.inputs.read(capability, tx);
    return {
      input,
      result: evaluateGraduation(input),
      digest: graduationInputDigest(input),
    };
  }
}
