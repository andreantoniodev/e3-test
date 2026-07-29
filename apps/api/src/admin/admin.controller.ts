import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminSecretGuard } from './admin-secret.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AdminSecretGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('units')
  listUnits() {
    return this.adminService.listUnits();
  }

  @Post('units')
  createUnit(@Body() body: { name?: string; slug?: string }) {
    return this.adminService.createUnit({
      name: body?.name || '',
      slug: body?.slug,
    });
  }

  @Patch('units/:id')
  updateUnit(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string },
  ) {
    return this.adminService.updateUnit(id, {
      name: body?.name,
      slug: body?.slug,
    });
  }

  @Delete('units/:id')
  deleteUnit(@Param('id') id: string) {
    return this.adminService.deleteUnit(id);
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Post('users')
  upsertUser(
    @Body() body: { email?: string; unitId?: string; name?: string },
  ) {
    return this.adminService.upsertUser({
      email: body?.email || '',
      unitId: body?.unitId || '',
      name: body?.name,
    });
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
