# Configuration Guide

Complete guide to configuring the Email Reader application.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [User Profile Setup](#user-profile-setup)
3. [Email Processing Configuration](#email-processing-configuration)
4. [AI Provider Configuration](#ai-provider-configuration)

---

## Environment Variables

### File Structure

Environment files are located in the **project root directory** for easy access:

| File | Location | Purpose | Git Status |
|------|----------|---------|-----------|
| `.env.example` | Project root | Template with placeholders and documentation | ✅ Committed |
| `.env.local` | Project root | Your actual credentials (created by copying `.env.example`) | ❌ Gitignored |

**We don't use `.env` files** - only `.env.example` (template) and `.env.local` (your credentials).

### Setup Instructions

```bash
# From project root directory
cp .env.example .env.local
# Edit .env.local with your real credentials
```

#### Environment Loading

The application loads environment variables in this priority:

1. `.env.local` (highest priority - your credentials)
2. `.env.example` (fallback - safe defaults)

This means:
- Variables in `.env.local` override everything
- If a variable isn't in `.env.local`, it falls back to `.env.example`
- No `.env` file needed!

### Required Variables

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-random-session-secret
NODE_ENV=development
```

**Generate a strong SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional Variables

#### AI API Keys

Configure AI providers (or use Settings UI after login):

```env
# OpenAI API (Default Provider)
OPENAI_API_KEY=your-openai-api-key

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Anthropic Claude API
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys
- Gemini: https://makersuite.google.com/app/apikey
- Anthropic: https://console.anthropic.com/

---

## User Profile Setup

### User Configuration File

**Location:** `.user-config.json` (project root)

**Created automatically** on first profile setup via the UI.

### Profile Fields

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "primary_email": "john.doe@company.com",
  "internal_domain": "@company.com"
}
```

### Profile Management

**Via UI:**
- Initial setup prompted on first login
- Edit via Settings page

**Via File:**
```bash
# View current profile
cat .user-config.json

# Delete profile (will prompt for re-entry on next login)
rm .user-config.json

# Manually edit (if needed)
nano .user-config.json
```

**Note:** This file is gitignored and won't be committed to the repository.

---

## Email Processing Configuration

Customize how emails are categorized and prioritized.

### Overview

The app automatically categorizes emails as:
- **Customer Emails** - Direct emails from real people
- **Internal Tool Notifications** - Automated emails from services (GitHub, Jira, etc.)
- **Newsletters** - Marketing content

You can customize this behavior via environment variables.

### Configuration Options

#### 1. Internal Tool Domains

**What it does:** Defines which domains are treated as "internal tools" vs customers.

**Default includes:** 60+ popular tools (GitHub, Jira, Slack, PagerDuty, Zendesk, Twilio, AWS, Stripe, etc.)

**When to customize:**
- Add a new tool not in the default list
- Remove a tool from the list

**Example:**
```env
# In backend/.env.local
INTERNAL_TOOL_DOMAINS=jira,github,slack,yourtool,customsaas
```

#### 2. Customer Domains

**What it does:** Forces specific domains to ALWAYS be treated as customers, even if they're in the internal tools list.

**Use case:** You work with companies like Twilio or GitHub as actual customers.

**Example:**
```env
# In backend/.env.local
CUSTOMER_DOMAINS=twilio.com,github.com,stripe.com
```

**Result:**
- ✅ `john.smith@twilio.com` → Customer email (grouped under "Twilio")
- ✅ `noreply@twilio.com` → Internal tool notification (automated)

#### 3. Notification Patterns

**What it does:** Identifies automated emails by looking for patterns in the sender address.

**Default patterns:** noreply, no-reply, notifications, notify, automated, donotreply, mailer-daemon

**Example:**
```env
# In backend/.env.local
NOTIFICATION_PATTERNS=noreply,no-reply,bot,automated,system
```

#### 4. Newsletter Domains

**What it does:** Identifies newsletter/marketing platforms to deprioritize.

**Default includes:** Substack, Beehiiv, ConvertKit, Mailchimp, etc.

**Example:**
```env
# In backend/.env.local
NEWSLETTER_DOMAINS=substack,beehiiv,customnewsletter
```

### Configuration Examples

#### Example 1: You Work With Twilio as a Customer

```env
# In backend/.env.local
CUSTOMER_DOMAINS=twilio.com
```

#### Example 2: Custom Internal Tools

```env
# In backend/.env.local
INTERNAL_TOOL_DOMAINS=github,jira,yourdashboard,yourcustomcrm
```

#### Example 3: Combined Configuration

```env
# In backend/.env.local

# Treat these as customers even though they're in the tools list
CUSTOMER_DOMAINS=github.com,twilio.com

# Add your custom internal tools
INTERNAL_TOOL_DOMAINS=github,jira,slack,supporthub,pagerduty

# Add custom newsletter sources
NEWSLETTER_DOMAINS=substack,beehiiv,companynewsletter.com
```

### Default Tool List

The app includes sensible defaults for 60+ popular tools:

**Project Management:** Jira, Asana, Trello, Notion, Monday, Confluence

**Version Control:** GitHub, GitLab, Bitbucket, CircleCI, Travis CI

**Communication:** Slack, Teams, Zoom, Webex

**Monitoring:** PagerDuty, Datadog, New Relic, Sentry, Splunk, Grafana

**Support/CRM:** Zendesk, Intercom, Salesforce, HubSpot, Freshdesk

**Cloud:** AWS, Azure, GCP, Heroku, Vercel, Netlify, Cloudflare

**And many more...**

See [`backend/src/config/emailConfig.ts`](backend/src/config/emailConfig.ts) for the complete list.

### Testing Your Configuration

1. **Edit `.env.local`:**
   ```bash
   cd backend
   nano .env.local
   ```

2. **Restart the app:**
   ```bash
   npm run dev
   ```

3. **Verify categorization:**
   - Fetch emails for a date range
   - Check grouping (customers vs internal tools)

4. **Adjust as needed**

---

## AI Provider Configuration

### Option 1: Via Environment Variables

```env
# In backend/.env.local
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Option 2: Via Settings UI

1. Log in to the app
2. Click Settings
3. Select AI provider
4. Enter API key
5. Choose model

**Note:** Settings UI configuration is session-based. Environment variables provide persistent defaults.

### Available Providers

| Provider | Models | Best For |
|----------|--------|----------|
| OpenAI (Default) | GPT-4o, GPT-4o-mini | General purpose, fast |
| Google Gemini | 2.0-flash, 2.5-flash, 2.5-pro | High-volume processing |
| Anthropic Claude | 3.5 Sonnet, 3.5 Haiku | High accuracy |

---

## Troubleshooting

### Environment Variables Not Loading

**Check:**
- ✅ File is named `.env.local` (not `.env`)
- ✅ File is in `backend/` directory
- ✅ Backend server was restarted after changes
- ✅ Values are comma-separated with no spaces

### Customer Emails Showing as Tools

**Solution:**
```env
CUSTOMER_DOMAINS=theircompany.com
```

### Tool Notifications Showing as Customers

**Solution:**
```env
INTERNAL_TOOL_DOMAINS=toolname,anothertool
```

### Profile Lost After Restart

**Check:**
- ✅ `.user-config.json` exists in project root
- ✅ File contains valid JSON
- ✅ File is readable

---

## Configuration Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `GOOGLE_CLIENT_ID` | String | Required | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | String | Required | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | String | Required | OAuth redirect URI |
| `SESSION_SECRET` | String | Required | Session encryption key |
| `PORT` | Number | 3001 | Backend server port |
| `FRONTEND_URL` | String | Required | Frontend URL for CORS |
| `OPENAI_API_KEY` | String | Optional | OpenAI API key |
| `GEMINI_API_KEY` | String | Optional | Gemini API key |
| `ANTHROPIC_API_KEY` | String | Optional | Anthropic API key |
| `INTERNAL_TOOL_DOMAINS` | CSV | [See code] | Internal tool domains |
| `CUSTOMER_DOMAINS` | CSV | Empty | Always-customer domains |
| `NOTIFICATION_PATTERNS` | CSV | noreply,etc | Automated email patterns |
| `NEWSLETTER_DOMAINS` | CSV | substack,etc | Newsletter domains |

---

## Questions?

- **Where do I configure?** `backend/.env.local`
- **Do I need to configure everything?** No, only what you want to customize
- **Can I see defaults?** Yes, check `.env.example` and `emailConfig.ts`
- **How do I test?** Restart app and fetch emails

For more help, see [README.md](README.md) or [SECURITY.md](SECURITY.md).
