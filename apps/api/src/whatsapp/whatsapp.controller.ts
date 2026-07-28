import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
@UseGuards(FirebaseAuthGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('connect')
  connect(@CurrentUser() user: AuthUser) {
    return this.whatsappService.connect(user.unitId, user.unit.slug);
  }

  @Get('qr')
  qr(@CurrentUser() user: AuthUser) {
    return this.whatsappService.getQr(user.unitId);
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.whatsappService.getStatus(user.unitId);
  }
}
