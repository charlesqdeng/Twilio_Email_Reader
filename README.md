# Email Reader - Gmail Summary App

A web application that allows users to log in with Google, read emails from their Gmail account, select a time range, and get AI-powered summaries organized by sender using Claude AI.

## Features

### Intelligence Layer ("The Brain")

- **AI Classification** - Automatically categorizes emails into:
  - Customer Support (bug reports, feature requests, support tickets)
  - Internal Update (team communications, project updates)
  - Event/Newsletter (marketing, announcements, events)
  - Trash (spam, promotional, irrelevant)

- **Task Extraction** - Identifies specific to-dos and suggested deadlines from email content
- **Priority Scoring** - Assigns P0-P3 priority based on urgency, sentiment, and keywords
  - P0: Critical issues, urgent customer problems, production bugs
  - P1: Important tasks, time-sensitive requests
  - P2: Normal priority, routine tasks
  - P3: Low priority, informational

- **Stakeholder Detection** - Extracts key people and teams mentioned in emails
- **Contextual Summaries** - Generates 2-3 sentence briefs for each email
- **Human-in-the-Loop** - Review and approve tasks before taking action

### Core Features

- **Google OAuth Authentication** - Secure login with your Google account
- **Date Range Selection** - Choose specific time periods to analyze
- **Email Fetching** - Retrieves emails from Gmail API
- **Multiple AI Providers** - Choose between OpenAI, Google Gemini, or Anthropic Claude
- **Task Review Queue** - Interactive dashboard to review and approve extracted tasks
- **Smart Filtering** - Filter by actionable items, priority, or category
- **Modern UI** - Clean, responsive interface built with React and Tailwind CSS

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Axios for API requests

### Backend
- Node.js with Express
- TypeScript
- Google OAuth 2.0
- Gmail API
- Multiple AI APIs (OpenAI, Google Gemini, Anthropic Claude)
- Express Session for authentication

## ⚠️ Security Notice

**IMPORTANT:** This application handles sensitive data including:
- Gmail API credentials
- OAuth tokens
- AI API keys
- Personal email content

**Before pushing to GitHub:**
1. ✅ Never commit `.env` or `.env.local` files (already in `.gitignore`)
2. ✅ Keep `.user-config.json` local (contains your profile data)
3. ✅ Use `.env.example` as a template (no real credentials)
4. ✅ Rotate any accidentally committed API keys immediately

**For local development:**
- Copy `.env.example` to `.env.local` and add your real credentials
- The app will load `.env.local` first, then fall back to `.env`
- `.env.local` is gitignored and safe for local development

## Prerequisites

Before you begin, ensure you have:

- Node.js (v18 or higher)
- npm or yarn
- A Google Cloud Project with Gmail API enabled
- At least one AI API key (OpenAI, Google Gemini, or Anthropic)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Twilio_EmailReader
```

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3001/api/auth/google/callback` (development)
   - Save your Client ID and Client Secret

### 3. Get AI API Key(s)

You'll need at least one of the following:

**Option A: OpenAI**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Create a new API key

**Option B: Google Gemini**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key

**Option C: Anthropic Claude**
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys and create one

### 4. Configure Environment Variables

#### Backend Configuration

**Set up your local environment:**

```bash
# From project root directory
cp .env.example .env.local
```

Edit `.env.local` (in project root) with your **real** credentials:

```env
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Optional: AI API keys (can also be configured in Settings UI)
OPENAI_API_KEY=your-actual-openai-api-key
GEMINI_API_KEY=your-actual-gemini-api-key
ANTHROPIC_API_KEY=your-actual-anthropic-api-key

PORT=3001
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-random-session-secret
NODE_ENV=development
```

**Security Tips:**
- ✅ Copy `.env.example` to `.env.local` for development (gitignored, never committed)
- ✅ `.env.example` is the template (safe to commit, contains documentation)
- ✅ Never create a `.env` file - only use `.env.local` for your credentials
- ✅ Generate a strong SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Note:** AI API keys can be configured either in `.env.local` OR through the Settings page after logging in.

**Optional - Email Processing Configuration:**

You can customize how emails are categorized (e.g., which domains are "internal tools" vs "customers"):

```env
# Treat these domains as customers (even if they're in the tools list)
CUSTOMER_DOMAINS=twilio.com,github.com

# Add custom internal tools
INTERNAL_TOOL_DOMAINS=jira,slack,yourtool

# Custom newsletter domains
NEWSLETTER_DOMAINS=substack,beehiiv
```

See [EMAIL_CONFIGURATION_GUIDE.md](EMAIL_CONFIGURATION_GUIDE.md) for details.

#### Frontend Configuration

```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 5. Install Dependencies

From the root directory:

```bash
npm run install:all
```

Or manually:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 6. Run the Application

From the root directory:

```bash
npm run dev
```

This will start both the backend server (port 3001) and frontend dev server (port 5173).

Alternatively, run them separately:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 7. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### 1. Initial Setup

**Grant Access:**
- Click "Sign in with Google" and authorize the application
- Grant Gmail read permissions

**Configure AI Settings:**
- Click "AI Settings" in the top navigation
- Choose your preferred AI provider (OpenAI, Gemini, or Anthropic)
- Enter your API key
- Optionally select a specific model
- Save your settings

### 2. Email Analysis Workflow

**Fetch Emails (Quick Actions):**
- Click one of the quick action buttons:
  - **Today** - Fetch last 24 hours
  - **Last 3 Days** - Fetch last 72 hours
  - **Last 7 Days** - Fetch last week
- Or expand "Custom Date Range" for specific dates

**Review Analyzed Emails:**
- The Intelligence Layer processes each email and provides:
  - Category classification
  - Priority score (P0-P3)
  - Extracted tasks with deadlines
  - Key stakeholders
  - AI-generated summary

**Filter and Prioritize:**
- Use filters to view:
  - All emails
  - Actionable items only
  - High priority (P0-P1)
  - Specific categories

**Approve Tasks:**
- Review extracted tasks
- Click "Approve" on tasks you want to track
- Approved tasks are marked for action

### 3. Task Management

The app identifies and structures:
- **Specific to-dos** from email content
- **Suggested deadlines** (extracted or inferred)
- **Urgency levels** (High, Medium, Low)
- **Key stakeholders** mentioned in the email

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback handler
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout user

### Emails
- `GET /api/emails` - Fetch emails (requires auth)
  - Query params: `startDate`, `endDate`
- `POST /api/emails/analyze` - Analyze emails with AI intelligence layer (requires auth)
  - Body: `{ emails: [...] }`
  - Returns: Classification, priority, tasks, stakeholders, summary for each email

### Configuration
- `GET /api/config` - Get AI provider configuration (requires auth)
- `POST /api/config` - Save AI provider settings (requires auth)
  - Body: `{ provider: string, apiKey: string, model?: string }`

## Project Structure

```
Twilio_EmailReader/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts        # Authentication routes
│   │   │   ├── emails.ts      # Email fetching and AI analysis
│   │   │   └── config.ts      # AI provider configuration
│   │   └── server.ts          # Express server setup
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.tsx              # Login page
│   │   │   ├── EmailDashboard.tsx     # Main dashboard
│   │   │   ├── DateRangePicker.tsx    # Date selection
│   │   │   ├── TaskReviewQueue.tsx    # Task review with approval
│   │   │   └── Settings.tsx           # AI provider configuration
│   │   ├── App.tsx            # Main app component
│   │   ├── main.tsx           # Entry point
│   │   └── index.css          # Global styles
│   ├── package.json
│   └── vite.config.ts
└── package.json               # Root package.json
```

## Security Considerations

- Never commit `.env` files to version control
- Use strong session secrets in production
- Enable HTTPS in production
- Regularly rotate API keys
- Review OAuth scopes to ensure minimal permissions

## Troubleshooting

### "Authentication Failed"
- Verify your Google Client ID and Secret are correct
- Ensure redirect URI matches exactly in Google Cloud Console
- Check that Gmail API is enabled

### "Failed to fetch emails"
- Verify you've granted Gmail read permissions during OAuth
- Check your Gemini API key is valid
- Ensure backend server is running

### CORS Errors
- Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check that `VITE_API_URL` in frontend `.env` points to backend

## Production Deployment

For production deployment:

1. Update environment variables:
   - Set `NODE_ENV=production`
   - Use secure session secret
   - Update redirect URIs in Google Cloud Console
   - Enable `secure` cookies (requires HTTPS)

2. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

3. Build the backend:
   ```bash
   cd backend
   npm run build
   ```

4. Deploy to your hosting service (Vercel, Heroku, AWS, etc.)

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
