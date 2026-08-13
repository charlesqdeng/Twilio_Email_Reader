# Email Reader

Email Reader is a Gmail-first workflow app that converts inbox traffic into a customer-centered task board. It fetches email, groups customer-related activity, applies AI classification, and helps a user review and approve only the work that matters.

## What the app does

- Authenticates with Google OAuth and reads Gmail data
- Analyzes incoming and sent email against a user profile
- Groups activity by customer instead of only by raw thread
- Classifies email into customer, internal, newsletter, or tool categories
- Extracts action items, deadlines, urgency, and stakeholders with AI
- Surfaces customer tasks in a board and a review queue
- Saves approvals to Google Sheets for follow-through
- Supports Gong call processing for next-step task generation
- Lets users set account owners and route tasks by owner where relevant

## Core features

### Inbox and customer grouping

- Customer-centric grouping for inbox content
- Sent-email view grouped by customer
- Summary view for activity trends across customers
- Priority scoring such as P0 through P3
- Direct-to-user and CC logic to identify likely actionable work

### AI and automation

- OpenAI, Gemini, and Anthropic provider support
- Configurable models and API keys in the app settings
- Reusable rules for tool domains, notification patterns, and newsletter detection
- Company alias normalization to collapse variant names for the same customer

### Task management and approvals

- Task extraction from email content
- Approval workflow stored in Google Sheets
- Per-user tracking and dismiss handling in the UI
- Bulk Gmail read-state updates after processing

### Gong workflow

- Fetch unread Gong call recordings with next steps
- Select account owners
- Convert each next step into tracked tasks
- Mark processed call emails as read after approval

## Tech stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express
- TypeScript
- Google OAuth 2.0
- Gmail API
- Google Sheets API
- OpenAI, Gemini, Anthropic SDKs
- Express session middleware

## Security and privacy

This project handles Gmail data, OAuth sessions, user profile data, and AI API keys. Keep the repo safe by following these rules:

- Never commit real `.env.local`, `.env`, or other local secret files
- Keep user profile data local and do not check in generated config files
- Use only placeholder examples in documentation
- Rotate any credentials that were accidentally exposed
- Treat all email content as sensitive and keep it out of public logs or screenshots

## Prerequisites

Before setup, ensure you have:

- Node.js 18+
- npm
- A Google Cloud project with the Gmail API enabled
- OAuth client credentials for a web app
- At least one AI provider key: OpenAI, Gemini, or Anthropic

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/your-repo.git
cd Twilio_EmailReader
```

### 2. Configure environment variables

From the project root, copy the template:

```bash
cp .env.example .env.local
```

Example values:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

PORT=3001
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-random-32-byte-secret
NODE_ENV=development
```

The app can also load provider keys through the Settings page after sign-in. Use `.env.local` for local development only.

### 3. Install dependencies

```bash
npm run install:all
```

### 4. Run the app

```bash
npm run dev
```

This starts the backend on port 3001 and the frontend on port 5173.

### 5. Open the app

Visit:

```text
http://localhost:3000
```

## Typical workflow

1. Sign in with Google
2. Complete the user profile and account settings
3. Pick a date range or use quick actions
4. Fetch Gmail data and analyze it
5. Review customer grouping, summaries, and extracted tasks
6. Approve or dismiss work items
7. Save final tasks to Google Sheets
8. Optionally process Gong call recordings and assign next steps

## Key API surfaces

- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/status`
- `POST /api/auth/logout`
- `GET /api/user/profile`
- `POST /api/user/profile`
- `GET /api/emails`
- `POST /api/emails/analyze`
- `POST /api/emails/mark-read`
- `POST /api/emails/mark-read-bulk`
- `POST /api/tasks/approve`
- `POST /api/tasks/unapprove`
- `GET /api/tasks/approved`

## Configuration notes

The app includes domain-based tuning for:

- internal tooling vs customer domains
- notification patterns
- newsletter or marketing sources
- alias normalization for companies with multiple naming variants

See the main configuration guide for the available environment variables and examples.

## Production considerations

- Use HTTPS in production
- Store secrets in a secure secret manager or deployment environment
- Restrict OAuth redirect URIs to the production domain
- Use a strong, random session secret
- Keep Gmail permissions minimal and intentional

## License

MIT

## Contributing

Use issues, pull requests, and branch-based development. Keep examples generic and do not include real customer names, email addresses, or API keys in committed files.
