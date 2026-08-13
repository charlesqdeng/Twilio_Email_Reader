# Deployment Guide

This guide summarizes the safe process for validating, publishing, and maintaining the Email Reader repository.

## 1. Pre-publish checklist

Before pushing code to GitHub, verify the following:

- No real `.env` or `.env.local` values are in the repo
- No user profile caches or email history files are staged
- No personal Gmail addresses, names, or account details appear in committed docs
- Example values are used everywhere in documentation
- The default behavior remains safe for local development only

### Recommended checks

```bash
git status
git diff --cached
grep -R -n -E "sk-[A-Za-z0-9]+|AIza[0-9A-Za-z\-_]+|GOCSPX-[A-Za-z0-9\-_]+|client_secret|api_key" . --exclude-dir=node_modules --exclude-dir=.git
```

The final search should return no real secrets.

## 2. Prepare the repo

Use a clean branch and keep the project generic:

```bash
git checkout -b release/docs-refresh
git add README.md CONFIGURATION.md SECURITY.md DEPLOYMENT_GUIDE.md .env.example
```

Only commit sanitized content and the intended application changes. Do not stage local config or cached workspace metadata.

## 3. Publish to GitHub

If the remote already exists, push normally:

```bash
git commit -m "docs: refresh project guidance and harden safety notes"
git push origin HEAD
```

If the repo needs to be created first:

```bash
git remote add origin https://github.com/your-org/your-repo.git
git branch -M main
git push -u origin main
```

## 4. Deployment options

### Local development

```bash
npm run install:all
npm run dev
```

### Production deployment

- Set `NODE_ENV=production`
- Use a secure session secret
- Configure production OAuth redirect URIs
- Use HTTPS only
- Keep secrets in a secure deployment vault or environment manager

## 5. Security follow-up

After publication, confirm:

- GitHub secret scanning is enabled
- Dependabot alerts are enabled if supported
- No local credentials remain in the repo history
- Example files are still placeholder-only

## 6. Final note

Do not share real credentials, profile snapshots, or customer data in repository artifacts or documentation. The repo should remain a safe example for onboarding, cloning, and local testing.

#### 4. Created Security Documentation

**New files:**
- `SECURITY.md` - Complete security policy
- `CONFIGURATION.md` - Configuration guide
- `DEPLOYMENT_GUIDE.md` - This file
- `.github/QUICK_SECURITY_REFERENCE.md` - Quick reference
- `.github/CONTRIBUTING.md` - Contribution guidelines

#### 5. Created Automation Scripts

**Security scanner:** `scripts/check-secrets.sh`
- Scans for sensitive files in git
- Detects secret patterns
- Verifies .env files use placeholders
- Validates .gitignore configuration

**Usage:**
```bash
npm run security:check
```

#### 6. Email Configuration System

Created configurable email processing:
- `backend/src/config/emailConfig.ts` - Configuration module
- Environment variables for customization
- 60+ default internal tool domains
- Customer domain overrides

See [CONFIGURATION.md](CONFIGURATION.md) for details.

### Security Verification

Run these commands to verify security:

```bash
# Security check
npm run security:check

# Verify no sensitive files
git status | grep -E "\.env\.local|\.user-config"
# Should return nothing

# Check what will be committed
git diff --cached

# Verify .gitignore
git check-ignore .env.local backend/.env.local .user-config.json
# All should output the filename
```

**Expected Result:** All checks pass ✅

---

## Maintaining Security

### Before Every Push

```bash
npm run security:check
git status  # Verify no .env.local files
```

### Monthly Security Review

```bash
# Check for outdated dependencies
npm audit

# Update dependencies
npm run install:all
```

### If Credentials Are Leaked

1. **Immediately rotate ALL credentials**
2. Follow incident response in [SECURITY.md](SECURITY.md)
3. Clean git history if needed
4. Update security documentation

---

## Troubleshooting

### Build Errors

```bash
# Clean and reinstall
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

### Port Already in Use

```bash
# Kill processes on ports
npm run clean:ports
```

### OAuth Redirect Issues

**Check:**
- `GOOGLE_REDIRECT_URI` matches Google Cloud Console
- Frontend URL matches `FRONTEND_URL` in backend

### Session Issues

**Solution:** Generate new `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Production Checklist

Before deploying to production:

- [ ] All `.env.local` files contain production values
- [ ] `NODE_ENV=production` is set
- [ ] `SESSION_SECRET` is a strong random value
- [ ] HTTPS is enabled for all endpoints
- [ ] OAuth redirect URIs include production domain
- [ ] CORS `origin` is set to production domain only
- [ ] Database connections use SSL/TLS (if applicable)
- [ ] Error logging is configured
- [ ] Health check endpoints are working
- [ ] Backup strategy is in place

---

## Questions?

- **Pre-publication:** See checklist above
- **Security:** See [SECURITY.md](SECURITY.md)
- **Configuration:** See [CONFIGURATION.md](CONFIGURATION.md)
- **General setup:** See [README.md](README.md)

**Ready to publish?** Follow the steps in [Publishing to GitHub](#publishing-to-github) above!
