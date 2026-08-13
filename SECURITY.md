# Security Policy

This project processes email content, OAuth credentials, API keys, and user profile data. Keep the repository free of secrets and personal details.

## Sensitive data to protect

- Google OAuth credentials
- AI provider API keys
- session secrets
- local profile files
- cached email data
- personal email addresses
- production redirect URIs with customer or personal domains

## Files that must stay local

These files are not safe to commit:

```text
.env
.env.local
.env.*.local
.user-config.json
.email-history.json
backend/.env.local
frontend/.env.local
```

The safe template files are:

```text
.env.example
backend/.env.example
frontend/.env.example
```

## Safe development practices

### 1. Use local environment files only

```bash
cp .env.example .env.local
```

Then add placeholder values or real local secrets only on the machine where the app is running.

### 2. Generate strong secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Keep examples generic

Use examples such as:

```text
user@company.com
owner@company.com
customer-domain.com
```

Never include:

- real names tied to a user account
- real Gmail addresses
- customer email addresses
- internal account owner lists
- real API tokens

### 4. Review before commit

Before pushing:

```bash
git status
git diff --cached
```

Check for accidentally staged local files or obvious secret text before continuing.

## If secrets are exposed

1. Rotate the compromised credentials immediately
2. Remove the secret from git history if it was committed
3. Update the repository protections and deployment config
4. Re-run a repo scan before pushing again

## OAuth and app security

Use development redirect URIs such as:

```text
http://localhost:3001/api/auth/google/callback
```

Use production URIs only for deployed environments. Keep the app behind HTTPS in production and use a strong random session secret.

## Reporting issues

If you discover a security issue, do not publish it in a public issue thread. Use private coordination with the maintainer or the repository owner and describe the vulnerability, reproduction steps, and impact.

## Production checklist

- Real secrets are stored in a secure secret manager or deployment environment
- `.env.local` is never deployed
- `SESSION_SECRET` is strong and random
- `NODE_ENV=production` is set only in deployed environments
- OAuth redirect URIs are limited to the correct domain
- Gmail scopes are kept to the minimum required
- API keys are rotated if they were ever exposed

## Repository policy

The repo should remain a sanitized example for others to run locally. No personal customer data, private names, or production credentials belong in committed source files.
