import { initializeApp } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();

export const getServerTime = onCall(
  {
    minInstances: 0,
    maxInstances: 2,
    enforceAppCheck: true,
  },
  (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    if (!request.auth.token.approved) {
      throw new HttpsError('permission-denied', 'Not approved');
    }

    return { timestamp: Date.now() };
  },
);
