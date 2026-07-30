import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ServiceAccount } from 'firebase-admin';

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\+n/g, '\n').replace(/\\+r/g, '');
}

function loadServiceAccount(): ServiceAccount {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON incompleto (project_id, client_email, private_key)',
      );
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured');
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY inválida (não contém BEGIN PRIVATE KEY)',
    );
  }

  return { projectId, clientEmail, privateKey };
}

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  private ensureInitialized() {
    if (admin.apps.length > 0) {
      return;
    }

    const serviceAccount = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
    this.logger.log(
      `Firebase Admin inicializado (project=${serviceAccount.projectId})`,
    );
  }

  verifyIdToken(token: string): Promise<DecodedIdToken> {
    this.ensureInitialized();
    return admin.auth().verifyIdToken(token);
  }
}
