import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ConversationsModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
