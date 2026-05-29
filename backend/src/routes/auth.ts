import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { readUserConfig } from '../config/userConfig';

const router = express.Router();

// Extend session type
declare module 'express-session' {
  interface SessionData {
    tokens: any;
  }
}

// Create OAuth client lazily to ensure environment variables are loaded
let _oauth2Client: any = null;
function getOAuth2Client() {
  if (!_oauth2Client) {
    _oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
    );
  }
  return _oauth2Client;
}

// Generate Google OAuth URL
router.get('/google', (req: Request, res: Response) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify', // Changed from readonly to allow marking as read
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/spreadsheets', // For creating/editing Google Sheets
    'https://www.googleapis.com/auth/drive.file' // For creating files in Drive
  ];

  const url = getOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({ url });
});

// Handle OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4173'}?error=no_code`);
  }

  try {
    const { tokens } = await getOAuth2Client().getToken(code as string);
    req.session.tokens = tokens;

    // Load user profile from file into session (if it exists)
    const userProfile = readUserConfig();
    if (userProfile) {
      req.session.userProfile = userProfile;
      console.log('✅ Loaded user profile into session:', userProfile.primary_email);
    }

    // Save session before redirecting to ensure tokens are persisted
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4173'}?error=session_save_failed`);
      }
      console.log('Session saved successfully, redirecting to frontend');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4173'}?auth=success`);
    });
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4173'}?error=auth_failed`);
  }
});

// Check auth status
router.get('/status', (req: Request, res: Response) => {
  if (req.session.tokens) {
    // If profile is not in session but exists in file, load it
    if (!req.session.userProfile) {
      const userProfile = readUserConfig();
      if (userProfile) {
        req.session.userProfile = userProfile;
      }
    }

    res.json({
      authenticated: true,
      hasProfile: !!req.session.userProfile
    });
  } else {
    res.json({
      authenticated: false,
      hasProfile: false
    });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

export default router;
