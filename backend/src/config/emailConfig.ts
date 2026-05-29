/**
 * Email Configuration
 *
 * This file contains configurable settings for email processing,
 * including internal tool domains, notification patterns, and
 * customer detection rules.
 */

export interface EmailConfig {
  // List of internal tool/service domains to treat as notifications
  internalToolDomains: string[];

  // Patterns to identify automated/notification emails
  notificationPatterns: string[];

  // Domains to always treat as customers (never as tools)
  customerDomains: string[];

  // Newsletter/marketing domains to deprioritize
  newsletterDomains: string[];
}

// Default configuration
const DEFAULT_CONFIG: EmailConfig = {
  // Internal tool/notification services
  // Emails from these domains are grouped under "Internal Tools & Notifications"
  // unless they appear to be direct, personal emails
  internalToolDomains: [
    // Project Management & Documentation
    'atlassian',
    'jira',
    'confluence',
    'asana',
    'trello',
    'notion',
    'monday',

    // Version Control & CI/CD
    'github',
    'gitlab',
    'bitbucket',
    'circleci',
    'jenkins',
    'travis-ci',

    // Communication & Collaboration
    'slack',
    'teams',
    'zoom',
    'webex',

    // Monitoring & Alerting
    'pagerduty',
    'datadog',
    'newrelic',
    'sentry',
    'splunk',
    'grafana',

    // Customer Support & CRM
    'zendesk',
    'intercom',
    'salesforce',
    'hubspot',
    'freshdesk',
    'helpscout',

    // Payment & Billing
    'stripe',
    'paypal',
    'square',
    'braintree',

    // Analytics & Tracking
    'segment',
    'amplitude',
    'mixpanel',
    'google-analytics',
    'heap',

    // Email & Marketing
    'mailchimp',
    'sendgrid',
    'postmark',
    'mandrill',
    'mailgun',
    'constantcontact',

    // Cloud Providers & Infrastructure
    'aws',
    'amazonaws',
    'azure',
    'gcp',
    'googlecloud',
    'heroku',
    'vercel',
    'netlify',
    'cloudflare',
    'digitalocean',

    // Communication Platforms (may also be customers)
    'twilio',
    'plivo',
    'nexmo',
    'vonage',

    // Developer Tools
    'npm',
    'docker',
    'kubernetes',
    'terraform',

    // Security & Auth
    'okta',
    'auth0',
    'onelogin',
    'duo',

    // Project Tracking & Time Management
    'harvest',
    'toggl',
    'clockify',
    'timely',
  ],

  // Patterns to identify automated/notification emails
  // Emails matching these patterns are likely automated
  notificationPatterns: [
    'noreply',
    'no-reply',
    'notifications',
    'notify',
    'alerts',
    'automated',
    'donotreply',
    'do-not-reply',
    'bounce',
    'mailer-daemon',
    'postmaster',
    'system',
    'admin',
  ],

  // Domains to ALWAYS treat as real customers
  // Useful if you work with companies that are also in the internalToolDomains list
  // Example: If Twilio is your customer, add 'twilio.com' here
  customerDomains: [
    // Add your customer domains here
    // Example:
    // 'customername.com',
    // 'clientcompany.com',
  ],

  // Newsletter/marketing domains to deprioritize
  newsletterDomains: [
    'substack',
    'beehiiv',
    'convertkit',
    'mailchimp',
    'sendinblue',
    'campaignmonitor',
    'aweber',
    'getresponse',
  ],
};

/**
 * Get email configuration
 *
 * Priority:
 * 1. Environment variables (if provided)
 * 2. User-specific config file (future enhancement)
 * 3. Default configuration
 */
export function getEmailConfig(): EmailConfig {
  const config: EmailConfig = { ...DEFAULT_CONFIG };

  // Allow overriding via environment variables
  if (process.env.INTERNAL_TOOL_DOMAINS) {
    config.internalToolDomains = process.env.INTERNAL_TOOL_DOMAINS
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);
  }

  if (process.env.CUSTOMER_DOMAINS) {
    config.customerDomains = process.env.CUSTOMER_DOMAINS
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);
  }

  if (process.env.NEWSLETTER_DOMAINS) {
    config.newsletterDomains = process.env.NEWSLETTER_DOMAINS
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);
  }

  if (process.env.NOTIFICATION_PATTERNS) {
    config.notificationPatterns = process.env.NOTIFICATION_PATTERNS
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 0);
  }

  return config;
}

/**
 * Check if a company/domain is an internal tool
 */
export function isInternalTool(companyOrDomain: string, config?: EmailConfig): boolean {
  const emailConfig = config || getEmailConfig();
  const normalized = companyOrDomain.toLowerCase();

  // Check if it's explicitly marked as a customer domain
  if (emailConfig.customerDomains.some(domain => normalized.includes(domain))) {
    return false; // It's a customer, not a tool
  }

  // Check if it matches internal tool patterns
  return emailConfig.internalToolDomains.some(tool => normalized.includes(tool));
}

/**
 * Check if an email address matches notification patterns
 */
export function isNotificationEmail(email: string, config?: EmailConfig): boolean {
  const emailConfig = config || getEmailConfig();
  const normalized = email.toLowerCase();

  return emailConfig.notificationPatterns.some(pattern => normalized.includes(pattern));
}

/**
 * Check if a domain is a newsletter/marketing domain
 */
export function isNewsletterDomain(domain: string, config?: EmailConfig): boolean {
  const emailConfig = config || getEmailConfig();
  const normalized = domain.toLowerCase();

  return emailConfig.newsletterDomains.some(nl => normalized.includes(nl));
}

export default {
  getEmailConfig,
  isInternalTool,
  isNotificationEmail,
  isNewsletterDomain,
};
