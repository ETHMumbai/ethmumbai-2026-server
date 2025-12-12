import { Controller } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PdfService } from './pdf.service';

@Controller('t')
export class TicketsController {
  constructor(
    private readonly ticketService: TicketsService,
    private readonly pdfService: PdfService,
  ) {}

  // Check-in endpoint removed for now (not in develop branch schema)
}