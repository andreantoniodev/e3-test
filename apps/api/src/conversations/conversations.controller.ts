import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(FirebaseAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.conversationsService.listByUnit(user.unitId);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversationsService.listMessages(user.unitId, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { body?: string },
  ) {
    return this.conversationsService.sendMessage(
      user.unitId,
      id,
      body?.body || '',
    );
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversationsService.remove(user.unitId, id);
  }
}
