import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uid, leagues, region, language, newsletterEnabled, userEmail } = req.body;

  if (!uid || !leagues || !region || !language || !userEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = getAdminDb();
    
    // Store user email in users collection
    await db.collection('users').doc(uid).set({
      email: userEmail,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Store dashboard settings in a separate collection
    await db.collection('dashboard_settings').doc(userEmail).set({
      leagues,
      region,
      language,
      newsletterEnabled,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save settings' });
  }
} 