import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../shared/config/env.validation.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// One SMTP transport for the process (Mailpit in development; the school's server once E-1 is answered).
@Injectable()
export class MailerService {
  private transport: Transporter | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get appBaseUrl(): string {
    return this.config.get('APP_BASE_URL', { infer: true }).replace(/\/$/, '');
  }

  async send(message: MailMessage): Promise<void> {
    this.transport ??= createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      secure: this.config.get('SMTP_SECURE', { infer: true }) === 'true',
      auth: this.config.get('SMTP_USER', { infer: true })
        ? {
            user: this.config.get('SMTP_USER', { infer: true }),
            pass: this.config.get('SMTP_PASSWORD', { infer: true }),
          }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await this.transport.sendMail({
      from: this.config.get('MAIL_FROM', { infer: true }),
      ...message,
    });
  }
}
