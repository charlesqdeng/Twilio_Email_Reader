import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { readUserConfig } from '../config/userConfig';
import { getEmailConfig, isInternalTool, isNotificationEmail, normalizeCompanyName } from '../config/emailConfig';

const router = express.Router();

// Type definitions
type Priority = 'P0' | 'P1' | 'P2' | 'P3';
type PriorityOrder = Record<Priority, number>;

// Helper function to create a properly configured OAuth2 client
// This ensures both client credentials AND user tokens are set
function createAuthenticatedClient(tokens: any): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens);
  return client;
}

// Helper function to extract email address from a string like "John Doe <john@example.com>"
function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<(.+?)>/);
  return match ? match[1].toLowerCase() : emailString.toLowerCase().trim();
}

// Helper function to extract company name from email domain
function extractCompanyFromDomain(email: string): string {
  const emailAddr = extractEmailAddress(email);
  const domain = emailAddr.split('@')[1];

  if (!domain) return 'Unknown Company';

  // Remove common TLDs and clean up
  const parts = domain.split('.');
  if (parts.length > 1) {
    // Take the second-to-last part (company name)
    const companyPart = parts[parts.length - 2];

    // Capitalize first letter of each word
    return companyPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

// Helper function to check if sender is external (not from internal domain)
function isExternalSender(fromEmail: string, internalDomain: string): boolean {
  const senderEmail = extractEmailAddress(fromEmail);
  return !senderEmail.endsWith(internalDomain.toLowerCase());
}

// Helper function to check if email is in To or CC fields
function isRecipientInField(field: string, targetEmail: string): boolean {
  if (!field) return false;
  const normalizedField = field.toLowerCase();
  const normalizedTarget = targetEmail.toLowerCase();
  return normalizedField.includes(normalizedTarget);
}

// Helper function to check if user is mentioned in email body
function isUserMentionedInBody(
  emailBody: string,
  userProfile: any
): boolean {
  if (!userProfile || !emailBody) return false;

  const bodyLower = emailBody.toLowerCase();
  const firstName = userProfile.first_name?.toLowerCase() || '';
  const lastName = userProfile.last_name?.toLowerCase() || '';
  const email = userProfile.primary_email?.toLowerCase() || '';

  // Check if user's name or email is mentioned in the body
  return (
    (firstName && bodyLower.includes(firstName)) ||
    (lastName && bodyLower.includes(lastName)) ||
    (email && bodyLower.includes(email))
  );
}

// Helper function to check if email body starts with user's first name
function startsWithUserName(emailBody: string, userProfile: any): boolean {
  if (!userProfile || !emailBody) return false;

  const firstName = userProfile.first_name?.toLowerCase() || '';
  if (!firstName) return false;

  // Clean up body - remove extra whitespace, get first few words
  const bodyTrimmed = emailBody.trim().toLowerCase();

  // Check if body starts with variations of the first name
  // e.g., "John,", "Hi John", "John -", "Hey John"
  const patterns = [
    `${firstName},`,       // "John,"
    `${firstName} `,       // "John "
    `${firstName}\n`,      // "John" followed by newline
    `hi ${firstName}`,     // "Hi John"
    `hey ${firstName}`,    // "Hey John"
    `hello ${firstName}`,  // "Hello John"
    `dear ${firstName}`,   // "Dear John"
  ];

  return patterns.some(pattern => bodyTrimmed.startsWith(pattern));
}

// Helper function to extract all email addresses from To/CC fields
function extractEmailsFromField(field: string): string[] {
  if (!field) return [];

  // Match all email addresses in the field
  const emailRegex = /<([^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emails: string[] = [];
  let match;

  while ((match = emailRegex.exec(field)) !== null) {
    const email = match[1] || match[2];
    if (email) {
      emails.push(email.toLowerCase());
    }
  }

  return emails;
}

// Helper function to find the first external recipient's company
function findExternalRecipientCompany(toField: string, ccField: string, internalDomain: string): string | null {
  const allRecipients = [
    ...extractEmailsFromField(toField),
    ...extractEmailsFromField(ccField)
  ];

  // Find first external recipient
  for (const recipient of allRecipients) {
    if (!recipient.endsWith(internalDomain.toLowerCase())) {
      return extractCompanyFromDomain(recipient);
    }
  }

  return null;
}

// Email configuration is now loaded from emailConfig.ts
// This allows customization via environment variables or config files
// See backend/.env.example for configuration options

// Helper function to extract customer name from Zendesk ticket
function extractZendeskCustomer(email: any): string | null {
  const subject = email.subject?.toLowerCase() || '';
  const body = email.body?.substring(0, 1000) || '';

  // Zendesk ticket format: [#12345] Customer Name: Issue description
  // Or: Re: [#12345] Customer Name
  const ticketMatch = subject.match(/\[#\d+\]\s*([^:]+?)(?::|$)/i);
  if (ticketMatch) {
    const customerName = ticketMatch[1].trim();
    // Filter out common Zendesk keywords
    if (!customerName.toLowerCase().includes('zendesk') &&
        !customerName.toLowerCase().includes('ticket') &&
        customerName.length > 2) {
      return customerName;
    }
  }

  // Try to extract from body - look for "Customer:" or "From:" lines
  const customerMatch = body.match(/(?:customer|from|requester):\s*([^\n]+)/i);
  if (customerMatch) {
    const customerName = customerMatch[1].trim();
    // Remove email address if present
    const cleanName = customerName.replace(/<[^>]+>/, '').trim();
    if (cleanName.length > 2) {
      return cleanName;
    }
  }

  return null;
}

// Helper function to determine primary company for grouping
// If internal email addressing a customer, group by customer company
function determinePrimaryCompany(
  email: any,
  userProfile: any
): string {
  let companyName: string;

  if (!userProfile) {
    companyName = extractCompanyFromDomain(email.from);
    return normalizeCompanyName(companyName);
  }

  const isInternal = !isExternalSender(email.from, userProfile.internal_domain);

  // If sender is internal, check if they're addressing an external customer
  if (isInternal) {
    const externalCompany = findExternalRecipientCompany(
      email.to || '',
      email.cc || '',
      userProfile.internal_domain
    );

    // If there's an external recipient, this email is about that customer
    if (externalCompany) {
      return normalizeCompanyName(externalCompany);
    }

    // Otherwise, it's a purely internal email
    companyName = extractCompanyFromDomain(email.from);
    return normalizeCompanyName(companyName);
  }

  // External sender - check if it's from an internal tool
  const fromCompany = extractCompanyFromDomain(email.from);

  // Special handling for Zendesk - extract actual customer name
  if (fromCompany.toLowerCase().includes('zendesk')) {
    const zendeskCustomer = extractZendeskCustomer(email);
    if (zendeskCustomer) {
      return normalizeCompanyName(zendeskCustomer);
    }
  }

  // If it's from a tool that's in the INTERNAL_TOOLS list, check if this is actually
  // a real customer email (e.g., someone from Twilio emailing you as a customer)
  // vs. an automated notification
  if (isInternalTool(fromCompany)) {
    // If the email is directly to the user (not CC'd) and has personal context,
    // treat it as a real customer email, not an internal tool notification
    const toField = (email.to || '').toLowerCase();
    const userEmail = userProfile.primary_email?.toLowerCase() || '';

    // Check if this looks like a direct, personal email (not automated)
    const isDirectEmail = toField.includes(userEmail) && !isNotificationEmail(toField);
    const hasPersonalFrom = email.from && !isNotificationEmail(email.from);

    // If it looks like a direct personal email (not an automated notification),
    // treat it as a customer email
    if (isDirectEmail && hasPersonalFrom) {
      return normalizeCompanyName(fromCompany); // Return the company name as a customer
    }

    // Otherwise, it's an internal tool notification
    return '🔧 Internal Tools & Notifications';
  }

  // External sender - group by their company
  return normalizeCompanyName(fromCompany);
}

// Helper function to determine smart priority based on PRD logic
function determineSmartPriority(
  email: any,
  userProfile: any,
  aiCategory: string
): 'P0' | 'P1' | 'P2' | 'P3' {
  if (!userProfile) {
    // Fallback to AI-determined priority if no user profile
    return 'P2';
  }

  const isExternal = isExternalSender(email.from, userProfile.internal_domain);
  const isDirectRecipient = isRecipientInField(email.to, userProfile.primary_email);
  const isCCd = isRecipientInField(email.cc, userProfile.primary_email);
  const userMentionedInBody = isUserMentionedInBody(email.body || '', userProfile);

  // PRD Priority Logic:
  // P0: (External OR Internal) emailing you directly (in To field) AND your name is mentioned in the message body
  if (isDirectRecipient && userMentionedInBody) {
    return 'P0';
  }

  // P1: External customers emailing you directly (in To field) OR External emails where you're CC'd
  if (isExternal && (isDirectRecipient || isCCd)) {
    return 'P1';
  }

  // P2: Internal support updates or team notifications
  if (!isExternal) {
    return 'P2';
  }

  // P3: Newsletters/Events (external but not direct to user)
  if (aiCategory === 'Event/Newsletter') {
    return 'P3';
  }

  // Default for other external emails
  return 'P2';
}

// Helper function to generate AI summary
async function generateAISummary(prompt: string, provider: string, apiKey: string, model?: string): Promise<string> {
  switch (provider) {
    case 'openai': {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      });
      return response.choices[0].message.content || '';
    }

    case 'anthropic': {
      const anthropic = new Anthropic({ apiKey });
      const message = await anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      return message.content[0].type === 'text' ? message.content[0].text : '';
    }

    case 'gemini': {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-2.5-flash' });
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    }

    default:
      throw new Error('Invalid AI provider');
  }
}

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: any) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Helper function to decode email body
function decodeBody(body: string): string {
  return Buffer.from(body, 'base64').toString('utf-8');
}

// Helper function to extract email content
function extractEmailContent(payload: any): string {
  if (payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBody(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBody(part.body.data);
      }
    }
    // Recursively search nested parts
    for (const part of payload.parts) {
      if (part.parts) {
        const content = extractEmailContent(part);
        if (content) return content;
      }
    }
  }

  return '';
}

// Get sent emails with date filter
router.get('/sent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const authClient = createAuthenticatedClient(req.session.tokens!);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Build query for sent emails
    let query = 'in:sent';
    if (startDate) {
      query += ` after:${startDate}`;
    }
    if (endDate) {
      query += ` before:${endDate}`;
    }

    // Get list of messages with pagination
    let allMessages: any[] = [];
    let pageToken: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const listResponse: any = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500,
        pageToken: pageToken
      });

      const messages = listResponse.data.messages || [];
      allMessages = allMessages.concat(messages);
      pageToken = listResponse.data.nextPageToken || undefined;
      hasMore = !!pageToken;

      console.log(`Sent: Fetched ${messages.length} messages, total so far: ${allMessages.length}`);
    }

    const messages = allMessages;
    console.log(`Sent: Total messages to process: ${messages.length}`);

    // Fetch full message details
    const emailPromises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });

      const headers = msg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const cc = headers.find(h => h.name?.toLowerCase() === 'cc')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const body = extractEmailContent(msg.data.payload!);

      return {
        id: msg.data.id,
        subject,
        from,
        to,
        cc,
        date,
        body: body.substring(0, 5000),
        snippet: msg.data.snippet
      };
    });

    const emails = await Promise.all(emailPromises);

    res.json({ emails });
  } catch (error: any) {
    console.error('Error fetching sent emails:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails', details: error.message });
  }
});

// Get emails with date filter or unread filter
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, unreadOnly } = req.query;

    const authClient = createAuthenticatedClient(req.session.tokens!);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Build query
    let query = 'in:inbox';

    // If unreadOnly is specified, filter for unread emails IN INBOX ONLY
    // This excludes unread emails that have been filtered into other labels
    if (unreadOnly === 'true') {
      query = 'is:unread in:inbox';
    } else {
      // Otherwise use date filters
      if (startDate && typeof startDate === 'string') {
        query += ` after:${startDate}`;
      }
      if (endDate && typeof endDate === 'string') {
        // Gmail's before: is exclusive, so add 1 day to make it inclusive
        const endDateObj = new Date(endDate.replace(/\//g, '-'));
        endDateObj.setDate(endDateObj.getDate() + 1);
        const inclusiveEndDate = endDateObj.toISOString().split('T')[0].replace(/-/g, '/');
        query += ` before:${inclusiveEndDate}`;
        console.log(`📅 Adjusted end date from ${endDate} to ${inclusiveEndDate} (inclusive)`);
      }
    }

    console.log(`📧 Query: ${query}`);

    // Get list of messages with pagination
    let allMessages: any[] = [];
    let pageToken: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const listResponse: any = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500, // Gmail API max per request
        pageToken: pageToken
      });

      const messages = listResponse.data.messages || [];
      allMessages = allMessages.concat(messages);
      pageToken = listResponse.data.nextPageToken || undefined;
      hasMore = !!pageToken;

      console.log(`Fetched ${messages.length} messages, total so far: ${allMessages.length}`);
    }

    const messages = allMessages;
    console.log(`Total messages to process: ${messages.length}`);

    // Fetch full message details
    const emailPromises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });

      const headers = msg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const cc = headers.find(h => h.name?.toLowerCase() === 'cc')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const body = extractEmailContent(msg.data.payload!);

      // Debug: Log all header names to identify CC header casing
      if (subject.includes('Mexico numbers')) {
        console.log('🔍 Debug - Headers for Mexico email:', headers.map(h => h.name).join(', '));
        console.log('🔍 Debug - CC value:', cc || '(empty)');
        console.log('🔍 Debug - To value:', to || '(empty)');
      }

      return {
        id: msg.data.id,
        subject,
        from,
        to,
        cc,
        date,
        body: body.substring(0, 5000), // Limit body length
        snippet: msg.data.snippet
      };
    });

    const emails = await Promise.all(emailPromises);

    res.json({ emails });
  } catch (error: any) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails', details: error.message });
  }
});

// Analyze emails with intelligence layer (batched with progress)
router.post('/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ error: 'Invalid emails data' });
    }

    // Get AI configuration from session or use default from environment
    let aiConfig = req.session.aiConfig;

    // If no session config, use OpenAI as default with API key from .env
    if (!aiConfig || !aiConfig.apiKey) {
      const defaultApiKey = process.env.OPENAI_API_KEY;
      if (!defaultApiKey) {
        return res.status(400).json({
          error: 'AI provider not configured. Please configure your AI settings or add OPENAI_API_KEY to .env'
        });
      }
      aiConfig = {
        provider: 'openai',
        apiKey: defaultApiKey,
        model: 'gpt-4o-mini'
      };
    }

    // Get user profile from session or load from file
    let userProfile = req.session.userProfile;
    console.log('📋 User profile from session:', userProfile ? 'EXISTS' : 'MISSING');
    if (!userProfile) {
      const configProfile = readUserConfig();
      console.log('📋 User profile from file:', configProfile ? `LOADED (${configProfile.primary_email})` : 'NOT FOUND');
      if (configProfile) {
        // Cache in session for future requests
        req.session.userProfile = configProfile;
        userProfile = configProfile;
      }
    }
    console.log('📋 Final userProfile:', userProfile ? `${userProfile.first_name} ${userProfile.last_name} (${userProfile.primary_email})` : 'UNDEFINED');

    // Set up SSE headers for streaming progress
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const BATCH_SIZE = 10;
    const totalEmails = emails.length;
    let processedCount = 0;
    const allAnalyzedEmails: any[] = [];

    console.log(`📊 Starting batched analysis: ${totalEmails} emails, batch size: ${BATCH_SIZE}`);

    // Process emails in batches
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchPromises = batch.map(async (email: any) => {
        const emailContent = `
Subject: ${email.subject}
From: ${email.from}
To: ${email.to}
CC: ${email.cc || 'None'}
Date: ${email.date}
Body: ${email.body.substring(0, 2000)}
`;

        const userContext = userProfile
          ? `\n\nIMPORTANT CONTEXT:
This email is being analyzed for: ${userProfile.first_name} ${userProfile.last_name} (${userProfile.primary_email})
Internal company domain: ${userProfile.internal_domain}

PRIORITY RULES (CRITICAL - FOLLOW EXACTLY):
- IGNORE COMPLETELY: Calendar invitations, meeting invites (subject contains "Invitation:", "Invite:", "Meeting:", etc.) - classify as "Trash" with P3 priority, actionable: false, tasks: []
- P0: Email is directly TO ${userProfile.primary_email} (in To field) AND ${userProfile.first_name}'s name, ${userProfile.last_name}, or ${userProfile.primary_email} is mentioned anywhere in the email body
- P1: External sender (not from ${userProfile.internal_domain}) emails ${userProfile.primary_email} directly (in To field) OR ${userProfile.primary_email} is CC'd on external email
- P2: Internal emails (from ${userProfile.internal_domain}) that don't meet P0 criteria
- P3: Newsletters, marketing emails, event invitations

Only extract tasks that are directly relevant to ${userProfile.first_name} - tasks they are explicitly asked to do or mentioned for.`
          : '';

        const prompt = `You are an intelligent email analysis system. Analyze the following email and provide a structured response in JSON format:

${emailContent}${userContext}

IMPORTANT - COMPANY NAME EXTRACTION RULES:
1. For Zendesk tickets: Extract the ACTUAL CUSTOMER NAME from the ticket subject or body, NOT "Zendesk"
   - Example: "[#12345] Acme Corp: Login issue" → company_name: "Acme Corp"
   - Example: "Re: [#67890] TechStart Inc - API Error" → company_name: "TechStart Inc"
2. For internal tool notifications (GitHub, Jira, Slack, PagerDuty, etc.): Use the tool name as-is
   - These will be grouped together automatically on the frontend
3. For direct customer emails: Use the sender's company from their email domain or signature

Provide your analysis in this exact JSON structure:
{
  "company_name": "Extract company name following rules above",
  "category": "Customer Support" | "Internal Update" | "Event/Newsletter" | "Trash",
  "priority": "P0" | "P1" | "P2" | "P3",
  "actionable": true | false,
  "summary": "2-3 sentence contextual summary",
  "tasks": [
    {
      "title": "Short task description",
      "deadline": "Extracted or suggested deadline (ISO format or 'None')",
      "urgency": "High" | "Medium" | "Low"
    }
  ],
  "stakeholders": ["List of people or teams mentioned"],
  "sentiment": "Urgent" | "Normal" | "Casual",
  "keywords": ["key", "words", "or", "phrases"],
  "solution_provided": "For sent emails: describe the solution provided, questions answered, or information/guidance given in this email. Summarize what problem was solved or what clarification was provided. For received emails: leave as empty string"
}

Classification Guide:
- Customer Support: Bug reports, feature requests, customer complaints, support tickets
- Internal Update: Team communications, project updates, meeting notes
- Event/Newsletter: Marketing emails, event invitations, newsletters, announcements
- Trash: Spam, promotional, irrelevant

Return ONLY valid JSON, no additional text.`;

        try {
          const aiResponse = await generateAISummary(
            prompt,
            aiConfig.provider,
            aiConfig.apiKey,
            aiConfig.model
          );

          // Parse AI response as JSON
          let analysis;
          try {
            // Try to extract JSON from response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysis = JSON.parse(jsonMatch[0]);
            } else {
              analysis = JSON.parse(aiResponse);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse AI response:', aiResponse);
            // Fallback analysis
            analysis = {
              company_name: determinePrimaryCompany(email, userProfile),
              category: 'Internal Update',
              priority: 'P2',
              actionable: false,
              summary: email.snippet || 'No summary available',
              tasks: [],
              stakeholders: [],
              sentiment: 'Normal',
              keywords: [],
              solution_provided: ''
            };
          }

          // Override company_name with smart logic
          analysis.company_name = determinePrimaryCompany(email, userProfile);

          // Determine if external sender
          const isExternal = userProfile
            ? isExternalSender(email.from, userProfile.internal_domain)
            : true;

          return {
            emailId: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            cc: email.cc,
            date: email.date,
            snippet: email.snippet,
            is_external: isExternal,
            ...analysis
          };
        } catch (error) {
          console.error('Error analyzing email:', error);
          return {
            emailId: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            cc: email.cc,
            date: email.date,
            snippet: email.snippet,
            company_name: determinePrimaryCompany(email, userProfile),
            is_external: true,
            category: 'Internal Update',
            priority: 'P2',
            actionable: false,
            summary: email.snippet || 'Analysis failed',
            tasks: [],
            stakeholders: [],
            sentiment: 'Normal',
            keywords: [],
            solution_provided: ''
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allAnalyzedEmails.push(...batchResults);
      processedCount += batchResults.length;

      console.log(`✅ Batch complete: ${processedCount}/${totalEmails} emails processed`);

      // Send progress update via SSE
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        current: processedCount,
        total: totalEmails,
        percentage: Math.round((processedCount / totalEmails) * 100)
      })}\n\n`);

    }

    console.log(`✨ All batches complete: ${processedCount} emails analyzed`);

    // Filter out meeting invitations/calendar invites
    const filteredEmails = allAnalyzedEmails.filter((email) => {
      const subject = email.subject.toLowerCase();
      const isMeetingInvite =
        subject.includes('invitation:') ||
        subject.includes('invite:') ||
        subject.includes('accepted:') ||
        subject.includes('canceled:') ||
        subject.includes('updated:') ||
        (subject.includes('invitation') && subject.includes('@'));

      if (isMeetingInvite) {
        console.log('🗓️ Filtered out meeting invite:', email.subject.substring(0, 60));
      }

      return !isMeetingInvite;
    });

    console.log(`📊 Filtered ${allAnalyzedEmails.length - filteredEmails.length} meeting invites, ${filteredEmails.length} emails remaining`);

    // Helper function to calculate similarity between two strings
    // Returns a score from 0 to 1 (1 = identical, 0 = completely different)
    function calculateSimilarity(str1: string, str2: string): number {
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();

      // Exact match
      if (s1 === s2) return 1.0;

      // Check if one string contains the other (high similarity)
      if (s1.includes(s2) || s2.includes(s1)) return 0.9;

      // Calculate word overlap similarity
      const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 3));
      const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 3));

      if (words1.size === 0 || words2.size === 0) return 0;

      const intersection = new Set([...words1].filter(w => words2.has(w)));
      const union = new Set([...words1, ...words2]);

      return intersection.size / union.size;
    }

    // Helper function to check if a task is a duplicate
    function isDuplicateTask(newTask: any, existingTasks: any[], similarityThreshold = 0.7): boolean {
      return existingTasks.some(existing => {
        const similarity = calculateSimilarity(newTask.title, existing.title);
        return similarity >= similarityThreshold;
      });
    }

    // Group by customer (company_name)
    const customerMap: { [key: string]: any } = {};

    filteredEmails.forEach((email) => {
      const customerName = email.company_name || 'Unknown Company';

      if (!customerMap[customerName]) {
        customerMap[customerName] = {
          customer_name: customerName,
          is_external: email.is_external,
          email_count: 0,
          highest_priority: email.priority,
          emails: [],
          all_tasks: []
        };
      }

      const customer = customerMap[customerName];
      customer.email_count++;
      customer.emails.push({
        emailId: email.emailId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        cc: email.cc,
        date: email.date,
        snippet: email.snippet,
        priority: email.priority,
        category: email.category,
        actionable: email.actionable,
        summary: email.summary,
        tasks: email.tasks,
        stakeholders: email.stakeholders,
        sentiment: email.sentiment,
        keywords: email.keywords,
        solution_provided: email.solution_provided
      });

      // Aggregate all tasks from this email with email metadata, with deduplication
      if (email.tasks && email.tasks.length > 0) {
        email.tasks.forEach((task: any) => {
          const taskWithEmailInfo = {
            ...task,
            emailId: email.emailId,         // Add email ID for linking
            emailSubject: email.subject,    // Add subject for context
            emailFrom: email.from,          // Add sender
            emailTo: email.to,              // Add recipients (To field)
            emailCc: email.cc,              // Add recipients (CC field)
            emailPriority: email.priority,  // Add email priority
            emailDate: email.date           // Add email date for sorting
          };

          // Check if this task is a duplicate
          if (!isDuplicateTask(taskWithEmailInfo, customer.all_tasks)) {
            customer.all_tasks.push(taskWithEmailInfo);
            console.log(`✅ Added unique task: "${task.title.substring(0, 60)}..."`);
          } else {
            console.log(`⚠️  Skipped duplicate task: "${task.title.substring(0, 60)}..." for customer ${customerName}`);
          }
        });
      }

      // Track highest priority (P0 > P1 > P2 > P3)
      const priorityOrder: PriorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
      if (priorityOrder[email.priority as Priority] < priorityOrder[customer.highest_priority as Priority]) {
        customer.highest_priority = email.priority;
      }
    });

    // Convert map to array and sort by priority
    const customers = Object.values(customerMap).sort((a, b) => {
      const priorityOrder: PriorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
      return priorityOrder[a.highest_priority as Priority] - priorityOrder[b.highest_priority as Priority];
    });

    // Within each customer group, sort emails newest first
    customers.forEach(customer => {
      customer.emails.sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    });

    // Send final complete event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      customers,
      analyzedEmails: filteredEmails
    })}\n\n`);

    res.end();
  } catch (error: any) {
    console.error('Error analyzing emails:', error);
    // Send error via SSE
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Failed to analyze emails',
      details: error.message
    })}\n\n`);
    res.end();
  }
});

// Summarize all customer-related activity across mail folders by customer name + domain
router.post('/customer-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customerName, domain, startDate, endDate } = req.body;

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(today.getDate() - 29);

    const effectiveStartDate = typeof startDate === 'string' && startDate ? startDate : defaultStartDate.toISOString().split('T')[0];
    const effectiveEndDate = typeof endDate === 'string' && endDate ? endDate : today.toISOString().split('T')[0];

    if (effectiveStartDate && effectiveEndDate && new Date(effectiveStartDate) > new Date(effectiveEndDate)) {
      return res.status(400).json({ error: 'Start date must be before end date.' });
    }

    const cleanedCustomerNames = String(customerName)
      .split(/[;,\n]+/)
      .map(name => name.trim())
      .filter(Boolean);

    const cleanedDomain = typeof domain === 'string'
      ? String(domain)
          .trim()
          .replace(/^@/, '')
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')
          .toLowerCase()
      : '';

    if (cleanedCustomerNames.length === 0) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const primaryCustomerName = cleanedCustomerNames[0];

    let aiConfig = req.session.aiConfig;
    if (!aiConfig || !aiConfig.apiKey) {
      const defaultApiKey = process.env.OPENAI_API_KEY;
      if (!defaultApiKey) {
        return res.status(400).json({
          error: 'AI provider not configured. Please configure your AI settings or add OPENAI_API_KEY to .env'
        });
      }
      aiConfig = {
        provider: 'openai',
        apiKey: defaultApiKey,
        model: 'gpt-4o-mini'
      };
    }

    let userProfile = req.session.userProfile;
    if (!userProfile) {
      const configProfile = readUserConfig();
      if (configProfile) {
        req.session.userProfile = configProfile;
        userProfile = configProfile;
      }
    }

    const authClient = createAuthenticatedClient(req.session.tokens!);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const customerSummaries: any[] = [];

    for (const customerName of cleanedCustomerNames) {
      const customerTerms = customerName
        .split(/\s+/)
        .filter(Boolean)
        .map(part => `"${part.replace(/[^a-zA-Z0-9\s-]/g, '')}"`)
        .slice(0, 6);

      const domainMatches = cleanedDomain
        ? [
            `from:${cleanedDomain}`,
            `to:${cleanedDomain}`,
            `cc:${cleanedDomain}`
          ].join(' OR ')
        : '';

      let query = cleanedDomain
        ? `in:anywhere (${customerTerms.length > 0 ? customerTerms.join(' OR ') : ''}) OR ${domainMatches}`
        : `in:anywhere (${customerTerms.length > 0 ? customerTerms.join(' OR ') : ''})`;

      if (!cleanedDomain && !query.includes('"')) {
        query = `in:anywhere`;
      }

      if (effectiveStartDate && typeof effectiveStartDate === 'string') {
        query += ` after:${effectiveStartDate}`;
      }
      if (effectiveEndDate && typeof effectiveEndDate === 'string') {
        const endDateObj = new Date(effectiveEndDate.replace(/\//g, '-'));
        endDateObj.setDate(endDateObj.getDate() + 1);
        const inclusiveEndDate = endDateObj.toISOString().split('T')[0].replace(/-/g, '/');
        query += ` before:${inclusiveEndDate}`;
      }

      let allMessages: any[] = [];
      let pageToken: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const listResponse: any = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 100,
          pageToken
        });

        const messages = listResponse.data.messages || [];
        allMessages = allMessages.concat(messages);
        pageToken = listResponse.data.nextPageToken || undefined;
        hasMore = !!pageToken;
      }

      if (allMessages.length === 0) {
        continue;
      }

      const emailPromises = allMessages.map(async (message) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers = msg.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name?.toLowerCase() === 'cc')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const body = extractEmailContent(msg.data.payload!);

        return {
          id: msg.data.id,
          subject,
          from,
          to,
          cc,
          date,
          body: body.substring(0, 4000),
          snippet: msg.data.snippet || ''
        };
      });

      const emails = await Promise.all(emailPromises);

      // Keep most recent emails and truncate bodies to avoid token overflow
      const recentEmails = emails
        .slice(-50)  // Take last 50 emails (most recent)
        .map((email) => ({
          ...email,
          body: (email.body || email.snippet || 'No body available').substring(0, 1000)  // Limit body to 1000 chars
        }));

      const emailContext = recentEmails
        .map((email, index) => {
          const dateLabel = email.date || `Email ${index + 1}`;
          return `--- Email ${index + 1} (${dateLabel}) ---\nFrom: ${email.from}\nTo: ${email.to || 'N/A'}\nCC: ${email.cc || 'N/A'}\nSubject: ${email.subject}\nBody:\n${email.body}`;
        })
        .join('\n\n');

      const summaryPrompt = `You are summarizing a customer's communication activity across all mail folders. Analyze the emails below for this customer and provide a structured JSON result only.

Customer Name: ${customerName}
Customer Domain: ${cleanedDomain || 'all domains'}
Date Range: ${effectiveStartDate || 'All available'} to ${effectiveEndDate || 'Now'}

Relevant emails:
${emailContext}

Return valid JSON in this exact structure:
{
  "customer_name": "${customerName}",
  "email_count": 0,
  "summary": "3-5 sentence summary of the customer's activity, relationship status, and important context",
  "themes": ["theme 1", "theme 2", "theme 3"],
  "stakeholders": ["person or team name"],
  "open_items": ["open issue or action item"],
  "risk_level": "Low | Medium | High",
  "recommended_next_steps": ["next step 1", "next step 2"]
}

Important:
- Focus on the relationship, recurring issues, urgency, and next actions.
- Do not invent specific people or facts that are not supported by the email content.
- If the email set is limited, still provide a useful summary and plausible follow-up actions.
- Return only valid JSON with no markdown fences.`;

      const aiResponse = await generateAISummary(summaryPrompt, aiConfig.provider, aiConfig.apiKey, aiConfig.model);

      let parsedSummary: any;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : aiResponse;
        parsedSummary = JSON.parse(jsonText);
      } catch (parseError) {
        parsedSummary = {
          customer_name: customerName,
          email_count: emails.length,
          summary: `This account shows ${emails.length} relevant email interactions. The customer appears to be engaged with ongoing work and discussions around current priorities, follow-up items, and operational needs.`,
          themes: ['Ongoing communication', 'Active follow-up', 'Customer engagement'],
          stakeholders: [customerName],
          open_items: ['Review latest customer thread for outstanding action items'],
          risk_level: 'Medium',
          recommended_next_steps: ['Review the most recent emails for action items', 'Confirm the next milestone with the customer']
        };
      }

      customerSummaries.push({
        customer_name: parsedSummary.customer_name || customerName,
        email_count: emails.length,
        summary: parsedSummary.summary || 'No summary could be generated from the available emails.',
        themes: Array.isArray(parsedSummary.themes) ? parsedSummary.themes : ['Customer communication'],
        stakeholders: Array.isArray(parsedSummary.stakeholders) ? parsedSummary.stakeholders : [customerName],
        open_items: Array.isArray(parsedSummary.open_items) ? parsedSummary.open_items : ['Review latest thread'],
        risk_level: parsedSummary.risk_level || 'Medium',
        recommended_next_steps: Array.isArray(parsedSummary.recommended_next_steps)
          ? parsedSummary.recommended_next_steps
          : ['Review the latest email thread', 'Confirm the next customer action'],
        matchingEmails: emails.map((email) => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.date,
          snippet: email.snippet || email.body?.slice(0, 220) || ''
        }))
      });
    }

    if (customerSummaries.length === 0) {
      return res.status(404).json({
        error: `No emails found for ${cleanedCustomerNames.join(', ')} (${cleanedDomain || 'all domains'}). Try a different date range or a different customer/domain.`
      });
    }

    res.json({
      success: true,
      summary: customerSummaries[0],
      summaries: customerSummaries,
      emails: customerSummaries.reduce((total, item) => total + (item.email_count || 0), 0)
    });
  } catch (error: any) {
    console.error('Error generating customer summary:', error);
    res.status(500).json({
      error: 'Failed to generate customer summary',
      details: error.message
    });
  }
});

// Export analyzed emails to JSON file
router.post('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customers, analyzedEmails } = req.body;

    if (!customers && !analyzedEmails) {
      return res.status(400).json({ error: 'No data to export' });
    }

    // Create export data with timestamp
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalCustomers: customers?.length || 0,
      totalEmails: analyzedEmails?.length || 0,
      customers: customers || [],
      emails: analyzedEmails || []
    };

    // Set headers for file download
    const filename = `email-analysis-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exportData);
  } catch (error: any) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
});

// Mark email as read in Gmail
router.post('/mark-read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { emailId } = req.body;

    if (!emailId) {
      console.error('❌ No emailId provided in request body');
      return res.status(400).json({ error: 'Email ID is required' });
    }

    console.log('📧 Marking email as read:', emailId);

    // Check if we have OAuth tokens
    if (!req.session.tokens) {
      console.error('❌ No OAuth tokens in session');
      return res.status(401).json({ error: 'Not authenticated - please log out and log back in' });
    }

    const authClient = createAuthenticatedClient(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Remove the UNREAD label to mark as read
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });

    console.log('✅ Email marked as read successfully');
    res.json({ success: true, message: 'Email marked as read' });
  } catch (error: any) {
    console.error('❌ Error marking email as read:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to mark email as read',
      details: error.message,
      code: error.code
    });
  }
});

// Mark multiple emails as read in Gmail
router.post('/mark-read-bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'Email IDs array is required' });
    }

    console.log(`📧 Marking ${emailIds.length} emails as read`);

    const authClient = createAuthenticatedClient(req.session.tokens!);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Mark emails as read in parallel
    const results = await Promise.allSettled(
      emailIds.map(emailId =>
        gmail.users.messages.modify({
          userId: 'me',
          id: emailId,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Marked ${successful} emails as read, ${failed} failed`);

    res.json({
      success: true,
      message: `Marked ${successful} of ${emailIds.length} emails as read`,
      successful,
      failed
    });
  } catch (error: any) {
    console.error('❌ Error marking emails as read:', error);
    res.status(500).json({
      error: 'Failed to mark emails as read',
      details: error.message
    });
  }
});

export default router;
