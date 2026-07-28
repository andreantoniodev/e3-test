import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@Controller()
export class UsersController {
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  me(@CurrentUser() user: {
    id: string;
    email: string;
    name: string | null;
    unit: { id: string; name: string; slug: string };
  }) {
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
