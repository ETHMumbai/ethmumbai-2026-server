import { Controller, Get, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiKeyGuard } from '../utils/api-key-auth';
import { TicketsService } from './tickets.service';
@Controller('t')
export class TicketsController {
  constructor(private readonly ticketService: TicketsService) {}

  //check-in is happening when this endpoint is hit -> change this to include a button/check that can be used by the team to check-in
  // @UseGuards(ApiKeyGuard)
  // @Get('verify')
  // async verify(@Query('token') token: string) {
  //   return await this.ticketService.verifyAndMark(token);
  // }
  @Get('/')
  async verify(
    @Query('token') token: string,
    @Headers('x-scanner-key') key: string,
  ) {
    const allowed = process.env.SCANNER_KEY || '';

    if (!key || !allowed.includes(key)) {
      const { participantName, ticketTypeTitle, buyerName } =
        await this.ticketService.checkInFallback(token);
      return (
        'Hi ' +
        participantName +
        ', Welcome to ETHMumbai! You have received the ' +
        ticketTypeTitle +
        ' ETHMumbai Conference ticket with ticket code : ' +
        token +
        ' paid for by ' +
        buyerName
      );
    }

    return this.ticketService.verifyAndMark(token);
  }
}
