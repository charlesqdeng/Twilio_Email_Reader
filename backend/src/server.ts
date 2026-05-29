// IMPORTANT: Load environment variables FIRST before any other imports
// This ensures all modules can access process.env values when they're loaded
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the project root directory (one level up from backend/)
const findProjectRoot = (): string => {
  // In development with tsx, cwd is the backend directory
  // Go up one level to project root where .env files are located
  if (process.env.NODE_ENV === 'production') {
    // In production, __dirname is dist/, so go up two levels to project root
    return path.resolve(__dirname, '../..');
  }
  // For tsx: cwd is backend/, so go up one level to project root
  return path.resolve(process.cwd(), '..');
};

const projectRoot = findProjectRoot();
const envLocalPath = path.resolve(projectRoot, '.env.local');
const envPath = path.resolve(projectRoot, '.env');

console.log('🔧 Loading environment variables...');
console.log('   Project root:', projectRoot);
console.log('   .env.local path:', envLocalPath);

// Load .env.local first (highest priority, gitignored)
const result = dotenv.config({ path: envLocalPath });
if (result.error) {
  console.log('⚠️  Failed to load .env.local:', result.error.message);
} else {
  console.log('✅ Loaded .env.local');
}

// Load .env as fallback (should only contain placeholders in repo)
dotenv.config({ path: envPath });

console.log('   GOOGLE_CLIENT_ID loaded:', !!process.env.GOOGLE_CLIENT_ID);
console.log('   GOOGLE_CLIENT_ID length:', process.env.GOOGLE_CLIENT_ID?.length || 0);

// Now import everything else AFTER environment variables are loaded
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import configRoutes from './routes/config';
import userRoutes from './routes/user';
import taskRoutes from './routes/tasks';
import gongRoutes from './routes/gong';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for large email payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true only when deploying with HTTPS
    httpOnly: true,
    sameSite: 'lax', // Required for OAuth redirects
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/config', configRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/gong', gongRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
