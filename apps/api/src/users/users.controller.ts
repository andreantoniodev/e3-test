import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@Controller()
export class UsersController {
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      unit: {
        id: user.unit.id,
        name: user.unit.name,
        slug: user.unit.slug,
      },
    };
  }
}
