#!/bin/bash

# Security check script to verify no secrets are committed
# Usage: ./scripts/check-secrets.sh
# Can also be used as a pre-commit hook

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Security Check: Scanning for accidentally committed secrets..."
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Not a git repository. Performing file-based checks only.${NC}"
  echo ""
  IS_GIT_REPO=false
else
  IS_GIT_REPO=true
fi

# Define sensitive files that should never be committed
SENSITIVE_FILES=(
  ".env.local"
  "backend/.env.local"
  "frontend/.env.local"
  ".user-config.json"
  "backend/.user-config.json"
  ".email-history.json"
  "backend/.email-history.json"
)

# Files that shouldn't exist (we only use .env.example and .env.local)
UNWANTED_FILES=(
  "backend/.env"
  "frontend/.env"
)

# Check if sensitive files exist and are tracked/staged
echo -e "${BLUE}1. Checking for sensitive files...${NC}"
FOUND_SENSITIVE=0

for file in "${SENSITIVE_FILES[@]}"; do
  if [ -f "$file" ]; then
    if [ "$IS_GIT_REPO" = true ]; then
      # Check if file is tracked in git
      if git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
        echo -e "${RED}❌ ERROR: Sensitive file is tracked by git: ${file}${NC}"
        echo -e "${YELLOW}   Run: git rm --cached ${file}${NC}"
        FOUND_SENSITIVE=1
      fi

      # Check if file is staged
      if git diff --cached --name-only 2>/dev/null | grep -q "^${file}$"; then
        echo -e "${RED}❌ ERROR: Sensitive file is staged: ${file}${NC}"
        echo -e "${YELLOW}   Run: git reset HEAD ${file}${NC}"
        FOUND_SENSITIVE=1
      fi
    fi
  fi
done

if [ $FOUND_SENSITIVE -eq 0 ]; then
  echo -e "${GREEN}✓ No sensitive files found in git${NC}"
fi

# Check for unwanted .env files (we only use .env.example and .env.local)
echo ""
echo -e "${BLUE}Checking for unwanted .env files...${NC}"
FOUND_UNWANTED=0

for file in "${UNWANTED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Found ${file} - should only use .env.example and .env.local${NC}"
    echo -e "${YELLOW}   Consider removing: rm ${file}${NC}"
    FOUND_UNWANTED=1
  fi
done

if [ $FOUND_UNWANTED -eq 0 ]; then
  echo -e "${GREEN}✓ No unwanted .env files found${NC}"
fi

# Check for secret patterns in files
echo ""
echo -e "${BLUE}2. Scanning files for secret patterns...${NC}"

# Patterns to search for (actual secrets, not placeholders)
PATTERNS=(
  "GOCSPX-[A-Za-z0-9_-]{28}"              # Google OAuth Client Secret
  "sk-proj-[A-Za-z0-9]{48,}"              # OpenAI API Key (new format)
  "sk-[A-Za-z0-9]{48}"                    # OpenAI API Key (old format)
  "AIzaSy[A-Za-z0-9_-]{33}"               # Google API Key (Gemini)
  "sk-ant-[A-Za-z0-9_-]{95,}"             # Anthropic API Key
  "[0-9]{12}-[A-Za-z0-9]{32}\.apps\.googleusercontent\.com"  # Real Google Client ID pattern
)

FOUND_SECRETS=0

# Check .env.example files specifically (should only have placeholders)
ENV_EXAMPLE_FILES=("backend/.env.example" "frontend/.env.example")
for env_file in "${ENV_EXAMPLE_FILES[@]}"; do
  if [ -f "$env_file" ]; then
    echo "   Checking $env_file..."
    for pattern in "${PATTERNS[@]}"; do
      if grep -qE "$pattern" "$env_file" 2>/dev/null; then
        echo -e "${RED}❌ ERROR: Potential secret found in ${env_file}${NC}"
        echo -e "${YELLOW}   Pattern matched: ${pattern}${NC}"
        FOUND_SECRETS=1
      fi
    done

    # Check if client IDs look real (not placeholders)
    if grep -E "GOOGLE_CLIENT_ID=" "$env_file" | grep -qv "your-"; then
      CLIENT_ID=$(grep "GOOGLE_CLIENT_ID=" "$env_file" | cut -d= -f2)
      if [[ $CLIENT_ID =~ ^[0-9]{12}-[A-Za-z0-9]{32}\.apps\.googleusercontent\.com$ ]]; then
        echo -e "${RED}❌ ERROR: Real Google Client ID found in ${env_file}${NC}"
        echo -e "${YELLOW}   This should be in .env.local, not .env.example${NC}"
        FOUND_SECRETS=1
      fi
    fi
  fi
done

# Check staged changes if in git repo
if [ "$IS_GIT_REPO" = true ]; then
  STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")
  if [ ! -z "$STAGED_FILES" ]; then
    echo "   Checking staged changes..."
    for pattern in "${PATTERNS[@]}"; do
      if git diff --cached 2>/dev/null | grep -qE "$pattern"; then
        echo -e "${RED}❌ ERROR: Potential secret in staged changes${NC}"
        echo -e "${YELLOW}   Pattern matched: ${pattern}${NC}"
        FOUND_SECRETS=1
      fi
    done
  fi
fi

if [ $FOUND_SECRETS -eq 0 ]; then
  echo -e "${GREEN}✓ No secret patterns detected${NC}"
fi

# Verify .env.example files use placeholders
echo ""
echo -e "${BLUE}3. Verifying .env.example files use placeholders...${NC}"

PLACEHOLDER_ISSUES=0
for env_file in "${ENV_EXAMPLE_FILES[@]}"; do
  if [ -f "$env_file" ]; then
    echo "   Checking $env_file..."

    # Check for placeholder format
    if ! grep -q "your-" "$env_file"; then
      echo -e "${YELLOW}⚠️  WARNING: ${env_file} may not use proper placeholders${NC}"
      echo -e "${YELLOW}   Expected format: your-google-client-id, your-api-key, etc.${NC}"
      PLACEHOLDER_ISSUES=1
    fi
  fi
done

if [ $PLACEHOLDER_ISSUES -eq 0 ]; then
  echo -e "${GREEN}✓ Placeholder format looks good${NC}"
fi

# Check .gitignore
echo ""
echo -e "${BLUE}4. Verifying .gitignore configuration...${NC}"

GITIGNORE_ISSUES=0
if [ -f ".gitignore" ]; then
  REQUIRED_IGNORES=(".env.local" "backend/.env.local" ".user-config.json" ".email-history.json")

  for ignore_pattern in "${REQUIRED_IGNORES[@]}"; do
    if ! grep -q "$ignore_pattern" .gitignore; then
      echo -e "${YELLOW}⚠️  WARNING: .gitignore missing: ${ignore_pattern}${NC}"
      GITIGNORE_ISSUES=1
    fi
  done

  if [ $GITIGNORE_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ .gitignore properly configured${NC}"
  fi
else
  echo -e "${RED}❌ ERROR: .gitignore file not found${NC}"
  GITIGNORE_ISSUES=1
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════"

TOTAL_ISSUES=$((FOUND_SENSITIVE + FOUND_UNWANTED + FOUND_SECRETS + PLACEHOLDER_ISSUES + GITIGNORE_ISSUES))

if [ $TOTAL_ISSUES -eq 0 ]; then
  echo -e "${GREEN}✅ Security check PASSED${NC}"
  echo -e "${GREEN}   No sensitive data detected. Safe to publish!${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Security check FAILED${NC}"
  echo -e "${RED}   Found ${TOTAL_ISSUES} issue(s) that need attention${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Remove any unwanted .env files: rm backend/.env"
  echo "  2. Use only .env.example (template) and .env.local (credentials)"
  echo "  3. Ensure .env.example files contain only placeholders (your-*)"
  echo "  4. Run: git rm --cached <file> (if sensitive files are tracked)"
  echo "  5. Update .gitignore if needed"
  echo "  6. Verify .env.local is gitignored"
  echo ""
  echo "For more details, see:"
  echo "  - SECURITY.md"
  echo "  - PRE_PUBLISH_CHECKLIST.md"
  echo ""
  exit 1
fi
