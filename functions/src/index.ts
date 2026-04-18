import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';

initializeApp();

export const getServerTime = onRequest(
  {
    maxInstances: 2,
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const decoded = await getAuth().verifyIdToken(
        authHeader.split('Bearer ')[1],
      );

      if (!decoded.approved) {
        res.status(403).json({ error: 'Not approved' });
        return;
      }

      res.json({ timestamp: Date.now() });
    } catch {
      res.status(403).json({ error: 'Invalid token' });
    }
  },
);
