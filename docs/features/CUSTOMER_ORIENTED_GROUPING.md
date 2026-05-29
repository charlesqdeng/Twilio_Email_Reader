# Customer-Oriented Grouping

## Overview
Updated the task board to be truly customer-oriented by intelligently grouping emails based on actual customer names rather than sender domains, and separating internal tool notifications.

## Changes Made

### Backend Changes (`backend/src/routes/emails.ts`)

#### 1. Internal Tools List
Added comprehensive list of internal tools/services that should be grouped separately:
```typescript
const INTERNAL_TOOLS = [
  'twilio', 'servicenow', 'atlassian', 'jira', 'confluence',
  'openai', 'github', 'gitlab', 'bitbucket', 'slack',
  'pagerduty', 'datadog', 'newrelic', 'sentry', 'stripe',
  'segment', 'amplitude', 'mixpanel', 'zendesk', 'intercom',
  'salesforce', 'hubspot', 'mailchimp', 'sendgrid', 'postmark',
  'aws', 'azure', 'gcp', 'heroku', 'vercel', 'netlify', 'cloudflare'
];
```

#### 2. Zendesk Customer Extraction
New function `extractZendeskCustomer()` that intelligently extracts actual customer names from Zendesk ticket notifications:

**Pattern Recognition:**
- `[#12345] Acme Corp: Issue description` → extracts "Acme Corp"
- `Re: [#67890] TechStart Inc - Problem` → extracts "TechStart Inc"
- Falls back to body parsing if subject doesn't contain customer name

**Smart Filtering:**
- Removes generic terms like "zendesk", "ticket"
- Strips email addresses
- Validates minimum name length

#### 3. Enhanced Company Determination Logic
Updated `determinePrimaryCompany()` to handle three scenarios:

**Scenario 1: Zendesk Tickets**
```typescript
// Before: "Zendesk" (not useful)
// After: "Acme Corp" (actual customer)
```

**Scenario 2: Internal Tool Notifications**
```typescript
// Groups all into: "🔧 Internal Tools & Notifications"
// Includes: GitHub, Jira, Slack, PagerDuty, etc.
```

**Scenario 3: Direct Customer Emails**
```typescript
// Uses sender's company (existing behavior)
```

#### 4. AI Prompt Enhancement
Updated AI analysis prompt with explicit rules:
```
COMPANY NAME EXTRACTION RULES:
1. For Zendesk tickets: Extract ACTUAL CUSTOMER NAME from subject/body
2. For internal tool notifications: Use tool name as-is
3. For direct customer emails: Use sender's company
```

### Frontend Changes (`frontend/src/components/CustomerTaskBoard.tsx`)

#### 1. Customer Sorting Logic
Added `sortedCustomers` that:
- **Real customers first** (sorted by priority: P0 → P1 → P2 → P3)
- **Internal tools last** (always appears at bottom)

```typescript
const sortedCustomers = [...customers].sort((a, b) => {
  const aIsInternal = isInternalTools(a.customer_name);
  const bIsInternal = isInternalTools(b.customer_name);

  if (aIsInternal && !bIsInternal) return 1;  // Internal last
  if (!aIsInternal && bIsInternal) return -1; // Customers first

  // Same type: sort by priority
  return priorityOrder[a.highest_priority] - priorityOrder[b.highest_priority];
});
```

#### 2. Visual Distinction
**Internal Tools Group:**
- Dimmed background: `bg-slate-800/50`
- Lighter border: `border-slate-600`
- Grey text: `text-slate-400`
- Badge: "Internal" (grey)

**Customer Groups:**
- Full background: `bg-slate-800`
- Normal border: `border-slate-700`
- White text: `text-white`
- Badge: "External" (blue) when applicable

## Usage Examples

### Before
```
📧 Email Task Board:
├── Zendesk          (P1) - 5 emails
├── GitHub           (P2) - 3 emails
├── Jira             (P2) - 2 emails
├── Acme Corp        (P0) - 1 email
└── TechStart Inc    (P1) - 2 emails
```

### After
```
📧 Email Task Board:
├── Acme Corp                           (P0) - 1 email  ← Real customer (P0)
├── TechStart Inc                       (P1) - 2 emails ← Real customer (P1)
├── Beta Industries                     (P1) - 3 emails ← Extracted from Zendesk
└── 🔧 Internal Tools & Notifications   (P2) - 10 emails
    ├── Zendesk system notifications
    ├── GitHub PR notifications
    ├── Jira ticket updates
    └── Slack digests
```

## Benefits

### 1. True Customer Focus
- Real customers always appear first, sorted by priority
- Account owners see customer needs immediately
- Internal noise grouped at the bottom

### 2. Zendesk Intelligence
- Extracts actual customer names from ticket subjects
- Groups all emails related to "Acme Corp" together
- Even if they came through Zendesk system

### 3. Reduced Clutter
- All tool notifications in one group
- Easy to expand/collapse internal tools section
- Focus stays on customer communications

### 4. Better Prioritization
- P0 customers always at top (regardless of source)
- Internal tools never distract from urgent customer issues
- Clear visual hierarchy

## Configuration

### Adding New Internal Tools
Edit `INTERNAL_TOOLS` array in `backend/src/routes/emails.ts`:
```typescript
const INTERNAL_TOOLS = [
  'twilio',
  'zendesk',
  'your-new-tool',  // Add here
  // ...
];
```

### Customizing Group Name
Change the internal tools group name:
```typescript
// In determinePrimaryCompany()
return '🔧 Internal Tools & Notifications';  // Customize this
```

### Adjusting Zendesk Pattern
Modify `extractZendeskCustomer()` regex patterns:
```typescript
const ticketMatch = subject.match(/\[#\d+\]\s*([^:]+?)(?::|$)/i);
```

## Edge Cases Handled

1. **Zendesk without customer name**: Falls back to "Zendesk"
2. **Mixed internal/external**: Correctly identifies based on domain
3. **Multiple Zendesk tickets**: All grouped under actual customer names
4. **Custom ticket formats**: Body parsing fallback
5. **Empty customer names**: Validation and filtering

## Testing Recommendations

1. **Test Zendesk extraction**:
   - Send test tickets with `[#123] CustomerName: Issue` format
   - Verify customer name extracted correctly

2. **Test internal tool grouping**:
   - Check GitHub, Jira, Slack notifications appear in "Internal Tools"
   - Verify they're sorted to bottom

3. **Test customer priority**:
   - P0 customers should appear first
   - Internal tools should appear last regardless of priority

4. **Test visual styling**:
   - Internal tools group should be visually dimmed
   - Customer cards should be prominent

## Future Enhancements

1. **ML-based customer extraction**: Use AI to better identify customer names
2. **Configurable grouping**: Let users customize internal tools list
3. **Sub-grouping**: Group internal tools by category (Monitoring, Development, etc.)
4. **Customer aliases**: Map multiple names to same customer
5. **Integration-specific extractors**: Custom logic for each tool type

---

**Date**: 2026-05-14  
**Status**: ✅ Complete  
**Impact**: Significantly improved customer-centric view for account managers
