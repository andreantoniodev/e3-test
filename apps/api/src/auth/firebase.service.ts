import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService {
  private ensureInitialized() {
    if (admin.apps.length > 0) {
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin is not configured');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  verifyIdToken(token: string): Promise<DecodedIdToken> {
    this.ensureInitialized();
    return admin.auth().verifyIdToken(token);
  }
}
