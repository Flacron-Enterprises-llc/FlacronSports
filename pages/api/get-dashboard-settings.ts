import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const db = getAdminDb();
    const doc = await db.collection('dashboard_settings').doc(email).get();

    if (!doc.exists) {
      return res.status(200).json({ 
        success: true, 
        settings: {
          leagues: [],
          region: "",
          language: "",
          newsletterEnabled: false
        }
      });
    }

    return res.status(200).json({ 
      success: true, 
      settings: doc.data() 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
} 