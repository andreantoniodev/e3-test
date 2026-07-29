import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException();
    }

    let decoded: { uid: string; email?: string; name?: string };
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (/Firebase Admin is not configured/i.test(detail)) {
        throw new UnauthorizedException(
          'Firebase Admin não configurado na API. Preencha FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
        );
      }
      throw new UnauthorizedException(
        'Token Firebase inválido ou expirado. Faça login novamente.',
      );
    }

    if (!decoded.email) {
      throw new UnauthorizedException(
        'Conta Google sem e-mail. Use outra conta ou libere o e-mail no Google.',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: decoded.email },
      include: { unit: true },
    });

    if (!user) {
      throw new ForbiddenException(
        `E-mail ${decoded.email} não está vinculado a nenhuma unidade. Cadastre-o no painel /admin.`,
      );
    }

    if (
      user.firebaseUid !== decoded.uid ||
      (decoded.name && user.name !== decoded.name)
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: decoded.uid,
          name: decoded.name ?? user.name,
        },
        include: { unit: true },
      });
    }

    request.user = user;
    return true;
  }
}
