import {
  Controller,
  Get,
  Query,
  UseGuards,
  Headers,
  Body,
  Post,
  Param,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ApiKeyGuard } from '../utils/api-key-auth';

@Controller('t')
export class TicketsController {
  constructor(private readonly ticketService: TicketsService) {}

  //check-in is happening when this endpoint is hit -> change this to include a button/check that can be used by the team to check-in
  @UseGuards(ApiKeyGuard)
  @Get('/:token')
  async verify(@Param('token') token: string) {
    const resp = await this.ticketService.verifyAndMark(token);
    if (resp?.ok == false) {
      return 'Check-in failed: ' + resp?.reason;
    }
    return (
      'Hi ' +
      resp?.participantName +
      ', Welcome to ETHMumbai! You have received the ' +
      resp?.ticketTypeTitle +
      ' ETHMumbai Conference ticket with ticket code : ' +
      token +
      ' paid for by ' +
      resp?.buyerName
    );
  }
}
