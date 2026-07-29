import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AdminController } from './admin.controller';
import { AdminSecretGuard } from './admin-secret.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [WhatsappModule],
  controllers: [AdminController],
  providers: [AdminService, AdminSecretGuard],
})
export class AdminModule {}
