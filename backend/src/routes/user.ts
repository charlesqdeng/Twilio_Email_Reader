import express, { Request, Response } from 'express';
import { configExists, readUserConfig, writeUserConfig, deleteUserConfig, getConfigFilePath } from '../config/userConfig';

const router = express.Router();

// Extend session type to include user profile
declare module 'express-session' {
  interface SessionData {
    tokens: any;
    aiConfig?: {
      provider: 'openai' | 'gemini' | 'anthropic';
      apiKey: string;
      model?: string;
    };
    userProfile?: {
      first_name: string;
      last_name: string;
      primary_email: string;
      internal_domain: string;
    };
  }
}

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: any) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Check if config file exists (no auth required for initial check)
router.get('/profile/exists', (req: Request, res: Response) => {
  const exists = configExists();
  res.json({
    exists,
    configPath: exists ? getConfigFilePath() : null
  });
});

// Get user profile
router.get('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    // Try to read from file first
    let profile = readUserConfig();

    if (profile) {
      // Cache in session for faster access
      req.session.userProfile = profile;
      return res.json({
        hasProfile: true,
        profile
      });
    }

    // Fallback to session if file doesn't exist
    profile = req.session.userProfile || null;

    if (!profile) {
      return res.json({ hasProfile: false });
    }

    res.json({
      hasProfile: true,
      profile
    });
  } catch (error: any) {
    console.error('Error getting profile:', error);
    res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

// Save user profile
router.post('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    const { first_name, last_name, primary_email, internal_domain, account_owners, approved_tasks_sheets } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !primary_email || !internal_domain) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(primary_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate domain format
    if (!internal_domain.startsWith('@')) {
      return res.status(400).json({ error: 'Internal domain must start with @' });
    }

    // Validate account_owners if provided
    if (account_owners && !Array.isArray(account_owners)) {
      return res.status(400).json({ error: 'account_owners must be an array' });
    }

    if (account_owners) {
      for (const owner of account_owners) {
        if (!owner.name || !owner.email) {
          return res.status(400).json({ error: 'Each account owner must have name and email' });
        }
        if (!emailRegex.test(owner.email)) {
          return res.status(400).json({ error: `Invalid email format for ${owner.name}` });
        }
      }
    }

    // Validate approved_tasks_sheets if provided
    if (approved_tasks_sheets && !Array.isArray(approved_tasks_sheets)) {
      return res.status(400).json({ error: 'approved_tasks_sheets must be an array' });
    }

    if (approved_tasks_sheets) {
      for (const sheet of approved_tasks_sheets) {
        if (!sheet.id || !sheet.name || !sheet.owner) {
          return res.status(400).json({ error: 'Each sheet must have id, name, and owner' });
        }
        // Validate that owner matches one of the account_owners (if provided)
        if (account_owners && account_owners.length > 0) {
          const ownerExists = account_owners.some((owner: any) => owner.name === sheet.owner);
          if (!ownerExists) {
            return res.status(400).json({
              error: `Sheet owner "${sheet.owner}" must match an account owner name`
            });
          }
        }
      }
    }

    const profile = {
      first_name,
      last_name,
      primary_email,
      internal_domain,
      ...(account_owners && { account_owners }),
      ...(approved_tasks_sheets && { approved_tasks_sheets })
    };

    // Save to file
    writeUserConfig(profile);

    // Also save to session for quick access
    req.session.userProfile = profile;

    res.json({
      success: true,
      message: 'Profile saved successfully to ' + getConfigFilePath(),
      profile
    });
  } catch (error: any) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save profile', details: error.message });
  }
});

// Update user profile
router.put('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    // Read current profile from file
    let currentProfile = readUserConfig();

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found. Please create a profile first.' });
    }

    const { first_name, last_name, primary_email, internal_domain, account_owners, approved_tasks_sheets } = req.body;

    // Validate account_owners if provided
    if (account_owners !== undefined) {
      if (!Array.isArray(account_owners)) {
        return res.status(400).json({ error: 'account_owners must be an array' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const owner of account_owners) {
        if (!owner.name || !owner.email) {
          return res.status(400).json({ error: 'Each account owner must have name and email' });
        }
        if (!emailRegex.test(owner.email)) {
          return res.status(400).json({ error: `Invalid email format for ${owner.name}` });
        }
      }
    }

    // Validate approved_tasks_sheets if provided
    if (approved_tasks_sheets !== undefined) {
      if (!Array.isArray(approved_tasks_sheets)) {
        return res.status(400).json({ error: 'approved_tasks_sheets must be an array' });
      }
      for (const sheet of approved_tasks_sheets) {
        if (!sheet.id || !sheet.name || !sheet.owner) {
          return res.status(400).json({ error: 'Each sheet must have id, name, and owner' });
        }
      }
    }

    // Update only provided fields
    const updatedProfile = {
      first_name: first_name || currentProfile.first_name,
      last_name: last_name || currentProfile.last_name,
      primary_email: primary_email || currentProfile.primary_email,
      internal_domain: internal_domain || currentProfile.internal_domain,
      ...(account_owners !== undefined ? { account_owners } : { account_owners: currentProfile.account_owners }),
      ...(approved_tasks_sheets !== undefined ? { approved_tasks_sheets } : { approved_tasks_sheets: currentProfile.approved_tasks_sheets })
    };

    // Save to file
    writeUserConfig(updatedProfile);

    // Update session
    req.session.userProfile = updatedProfile;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Delete user profile
router.delete('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    deleteUserConfig();

    // Clear from session
    req.session.userProfile = undefined;

    res.json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: 'Failed to delete profile', details: error.message });
  }
});

export default router;
