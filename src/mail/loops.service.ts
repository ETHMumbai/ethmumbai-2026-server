import { Injectable, Logger } from '@nestjs/common';
import { LoopsClient } from 'loops';

@Injectable()
export class LoopsService {
  private readonly logger = new Logger(LoopsService.name);
  private client: LoopsClient;

  constructor() {
    const apiKey = process.env.LOOPS_API_KEY;

    if (!apiKey) {
      this.logger.error('Missing LOOPS_API_KEY environment variable');
      throw new Error('LOOPS_API_KEY is required for LoopsService');
    }

    this.client = new LoopsClient(apiKey);
  }

  // send transactional mails
  async sendTransactionalEmail(
    transactionalId: string,
    email: string,
    dataVariables: Record<string, any>,
    attachments: Array<{
      filename: string;
      contentType: string;
      data: string; // base64 string
    }> = [],
  ) {
    try {
      const resp = await this.client.sendTransactionalEmail({
        transactionalId,
        email,
        dataVariables,
        attachments,
      });

      if (!resp.success) {
        this.logger.error(
          `Loops transactional email failed → ${email}: ${JSON.stringify(resp)}`,
        );
      }

      return resp;
    } catch (err) {
      this.logger.error(
        `Exception while sending Loops transactional email (${email}): ${err}`,
      );
      throw err;
    }
  }

  // updateContact properties
  async updateContact(email: string, properties: Record<string, any> = {}) {
    try {
      const resp = await this.client.updateContact({
        email,
        properties,
      });

      if (!resp.success) {
        this.logger.error(
          `Loops updateContact failed → ${email}: ${JSON.stringify(resp)}`,
        );
      }

      return resp;
    } catch (err) {
      this.logger.error(
        `Exception in Loops updateContact (${email}): ${err}`,
      );
      throw err;
    }
  }

  /* ------------------------------------------------------
     SEND EVENT
     (Loops expects eventProperties, NOT "data")
  -------------------------------------------------------- */
  async sendEvent(
    email: string,
    eventName: string,
    eventProps: Record<string, any> = {},
  ) {
    try {
      const resp = await this.client.sendEvent({
        email,
        eventName,
        eventProperties: eventProps,
      });

      if (!resp.success) {
        this.logger.error(
          `Loops sendEvent failed → ${email}::${eventName} — ${JSON.stringify(resp)}`,
        );
      }

      return resp;
    } catch (err) {
      this.logger.error(
        `Exception sending Loops event (${email}): ${err}`,
      );
      throw err;
    }
  }
}
