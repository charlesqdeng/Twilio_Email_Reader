import express, { Request, Response } from 'express';

const router = express.Router();

// Extend session type to include AI config
declare module 'express-session' {
  interface SessionData {
    tokens: any;
    aiConfig?: {
      provider: 'openai' | 'gemini' | 'anthropic';
      apiKey: string;
      model?: string;
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

// Get AI configuration
router.get('/', requireAuth, (req: Request, res: Response) => {
  const config = req.session.aiConfig || {
    provider: 'gemini',
    apiKey: '',
    model: ''
  };

  // Don't send the full API key to frontend (only show last 4 chars)
  const maskedConfig = {
    ...config,
    apiKey: config.apiKey ? `****${config.apiKey.slice(-4)}` : ''
  };

  res.json(maskedConfig);
});

// Save AI configuration
router.post('/', requireAuth, (req: Request, res: Response) => {
  const { provider, apiKey, model } = req.body;

  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Provider and API key are required' });
  }

  if (!['openai', 'gemini', 'anthropic'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  req.session.aiConfig = {
    provider: provider as 'openai' | 'gemini' | 'anthropic',
    apiKey,
    model: model || ''
  };

  res.json({ success: true, message: 'Configuration saved' });
});

export default router;
