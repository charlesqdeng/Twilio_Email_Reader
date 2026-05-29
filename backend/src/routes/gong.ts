import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const router = express.Router();

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

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: any) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Helper to extract call title from email
function extractCallTitle(body: string): string {
  // Pattern 1: "Twilio | Customer Name Meeting Title"
  let titleMatch = body.match(/Twilio\s*\|\s*([^\n•]+)/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Pattern 2: "Customer Name <> Twilio Meeting Title"
  titleMatch = body.match(/([^\n]+?)\s*<>\s*Twilio[^\n]+/i);
  if (titleMatch) {
    return titleMatch[0].trim();
  }

  // Pattern 3: Look for any title after "Your call is ready"
  titleMatch = body.match(/Your call is ready\s+([^\n]+)/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return 'Gong Call';
}

// Helper to extract customer name from call title
function extractCustomerName(callTitle: string): string {
  // Pattern 1: "Customer Name <> Twilio..." - extract just the customer name before <>
  const match1 = callTitle.match(/^([^<>]+?)\s*<>/);
  if (match1) {
    return match1[1].trim();
  }

  // Pattern 2: "Twilio | Customer Name Meeting Description" - extract after pipe
  const match2 = callTitle.match(/Twilio\s*\|\s*([^-•]+?)(?:\s+(weekly|monthly|quarterly|sync|call|meeting|check-in|review|support|discussion)|$)/i);
  if (match2) {
    return match2[1].trim();
  }

  // Pattern 3: Take everything before common meeting keywords
  const match3 = callTitle.match(/^([^-•]+?)(?:\s+(weekly|monthly|quarterly|sync|call|meeting|check-in|review|support|discussion)|$)/i);
  if (match3) {
    return match3[1].trim();
  }

  return 'Unknown Customer';
}

// Helper to extract "Go to call" URL
function extractGongUrl(body: string): string {
  // Pattern 1: Look for URL in href attribute near "Go to call"
  const hrefMatch = body.match(/Go to call[^>]*?href=["']([^"']+)["']/i);
  if (hrefMatch) {
    return hrefMatch[1].trim();
  }

  // Pattern 2: Look for Gong URL pattern (https://...gong.io/call?id=...)
  const urlMatch = body.match(/(https?:\/\/[^\s]*gong\.io[^\s"'<>]*)/i);
  if (urlMatch) {
    return urlMatch[1].trim();
  }

  // Pattern 3: Look for URL after "Go to call"
  const afterMatch = body.match(/Go to call\s*([^\s\n]+)/i);
  if (afterMatch) {
    return afterMatch[1].trim();
  }

  return '';
}

// Helper to extract Participants section
function extractParticipants(body: string): string {
  // Pattern 1: Look for "Twilio: Name • Customer: Name" format (inline in header)
  // This appears right after the date/duration line
  const inlineMatch = body.match(/Twilio:\s*([^•]+?)\s*•\s*Customer:\s*([^•\n]+?)(?:\s+Go to call|Generate|Key points|Next steps|\n)/i);
  if (inlineMatch) {
    const twilioParticipants = inlineMatch[1].trim();
    const customerParticipants = inlineMatch[2].trim();
    return `Twilio: ${twilioParticipants} | Customer: ${customerParticipants}`;
  }

  // Pattern 2: Look for "Participants" section (structured format)
  const participantsMatch = body.match(/Participants[:\s]*\n([\s\S]+?)(?=\n\n|Want to know|Associated deals|Shared with|Get the Gong|Listen to sales|You're receiving|$)/i);
  if (participantsMatch) {
    const participantsText = participantsMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.includes('Get the Gong') && !line.includes('Listen to sales') && !line.includes('You\'re receiving'))
      .slice(0, 10) // Max 10 lines
      .join(', ');
    return participantsText;
  }

  return '';
}

// Helper to extract next steps mentioning user
function extractAllNextSteps(body: string): Array<{ text: string; deadline?: string }> {
  const nextSteps: Array<{ text: string; deadline?: string }> = [];

  // Log a sample of the body for debugging
  console.log(`📄 Email body preview (first 500 chars):\n${body.substring(0, 500)}\n`);

  // Try multiple patterns to find "Next steps" section
  // Pattern 1: "Next steps" with optional colon, followed by newlines
  let nextStepsMatch = body.match(/Next\s+steps:?\s*[\r\n]+([\s\S]+?)(?=\n\n[A-Z]|Want\s+to\s+know|Associated\s+deals|Participants|Shared\s+with|$)/i);

  // Pattern 2: Try looking for numbered list after "Next steps"
  if (!nextStepsMatch) {
    nextStepsMatch = body.match(/Next\s+steps:?\s*[\r\n]+(\d+\.[\s\S]+?)(?=\n\n[A-Z]|Want\s+to\s+know|Associated\s+deals|Participants|Shared\s+with|$)/i);
  }

  // Pattern 3: More aggressive - just find any numbered list after "Next steps"
  if (!nextStepsMatch) {
    const nextStepsIndex = body.search(/Next\s+steps:?/i);
    if (nextStepsIndex !== -1) {
      const afterNextSteps = body.substring(nextStepsIndex);
      // Find content until we hit another section header or double newline
      const contentMatch = afterNextSteps.match(/Next\s+steps:?\s*[\r\n]+((?:\d+\.[\s\S]*?(?:\r?\n|$))+)/i);
      if (contentMatch) {
        nextStepsMatch = contentMatch;
      }
    }
  }

  if (!nextStepsMatch) {
    console.log('⚠️ No "Next steps" section found in email body');
    console.log('Attempting to search for section...');
    console.log(`Email contains "Next steps": ${body.includes('Next steps')}`);
    console.log(`Email contains "Next steps:": ${body.includes('Next steps:')}`);
    return nextSteps;
  }

  const nextStepsText = nextStepsMatch[1];
  console.log(`📝 Found Next steps section (${nextStepsText.length} chars)`);
  console.log(`First 200 chars of section: "${nextStepsText.substring(0, 200)}"`);

  // Split by numbered items - match various formats
  // Look for: newline + optional whitespace + digit(s) + period + whitespace
  const lines = nextStepsText.split(/\r?\n/);
  let currentItem = '';

  for (const line of lines) {
    // Check if line starts with a number followed by period (ignoring leading whitespace)
    const numberMatch = line.match(/^\s*(\d+)\.\s+(.+)/);

    if (numberMatch) {
      // Save previous item if exists
      if (currentItem.trim()) {
        const cleanText = currentItem.replace(/[\r\n\t]+/g, ' ').trim();
        if (cleanText.length > 0) {
          // Try to extract deadline if mentioned
          const deadlineMatch = cleanText.match(/(?:by|before|on)\s+([A-Z][a-z]+\s+\d{1,2}(?:,\s+\d{4})?)/i);
          const deadline = deadlineMatch ? deadlineMatch[1] : undefined;

          console.log(`  ✓ Extracted item: "${cleanText.substring(0, 60)}..."`);
          nextSteps.push({ text: cleanText, deadline });
        }
      }
      // Start new item with the content after the number
      currentItem = numberMatch[2];
    } else if (line.trim() && currentItem) {
      // Continuation of current item
      currentItem += ' ' + line.trim();
    }
  }

  // Don't forget the last item
  if (currentItem.trim()) {
    const cleanText = currentItem.replace(/[\r\n\t]+/g, ' ').trim();
    if (cleanText.length > 0) {
      const deadlineMatch = cleanText.match(/(?:by|before|on)\s+([A-Z][a-z]+\s+\d{1,2}(?:,\s+\d{4})?)/i);
      const deadline = deadlineMatch ? deadlineMatch[1] : undefined;

      console.log(`  ✓ Extracted item: "${cleanText.substring(0, 60)}..."`);
      nextSteps.push({ text: cleanText, deadline });
    }
  }

  console.log(`✅ Total extracted: ${nextSteps.length} next step(s)`);

  // Filter for only tasks mentioning the user
  const userSteps = nextSteps.filter(step => {
    const text = step.text.toLowerCase();
    // This would be replaced with actual user name from profile
    return text.includes('user name') || text.includes('user');
  });

  console.log(`🎯 Filtered to ${userSteps.length} task(s) for user`);
  return userSteps;
}

// GET /api/gong/calls - Fetch unread Gong emails with label "3--customers-recording"
router.get('/calls', requireAuth, async (req: Request, res: Response) => {
  try {
    const authClient = createAuthenticatedClient(req.session.tokens!);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    console.log('📞 Fetching unread Gong call recordings...');

    // Build query for Gong emails with specific label
    const query = 'from:do-not-reply@gong.io is:unread label:3--customers-recording';
    console.log(`📧 Query: ${query}`);

    // Get list of messages
    const listResponse: any = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });

    const messages = listResponse.data.messages || [];
    console.log(`📩 Found ${messages.length} unread Gong emails`);

    if (messages.length === 0) {
      return res.json({ calls: [] });
    }

    // Fetch full message details
    const calls = [];
    for (const message of messages) {
      try {
        const fullMessage: any = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const headers = fullMessage.data.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';

        // Get email body - recursively search through nested parts
        let body = '';
        let htmlBody = '';

        function logStructure(parts: any[], depth = 0) {
          const indent = '  '.repeat(depth);
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            console.log(`${indent}Part ${i}: mimeType=${part.mimeType}, hasBodyData=${!!part.body?.data}, hasSize=${part.body?.size}, hasParts=${!!part.parts}`);
            if (part.parts) {
              logStructure(part.parts, depth + 1);
            }
          }
        }

        function extractBodyFromParts(parts: any[]): { text: string; html: string } {
          let text = '';
          let html = '';

          for (const part of parts) {
            // Check for text/plain
            if (part.mimeType === 'text/plain' && part.body?.data) {
              text = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }

            // Check for text/html
            if (part.mimeType === 'text/html' && part.body?.data) {
              html = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }

            // If this part has nested parts, search recursively
            if (part.parts && part.parts.length > 0) {
              const nested = extractBodyFromParts(part.parts);
              if (!text && nested.text) text = nested.text;
              if (!html && nested.html) html = nested.html;
            }
          }

          return { text, html };
        }

        if (fullMessage.data.payload.parts) {
          console.log('📦 Email MIME structure:');
          logStructure(fullMessage.data.payload.parts);

          const extracted = extractBodyFromParts(fullMessage.data.payload.parts);
          body = extracted.text;
          htmlBody = extracted.html;
        } else if (fullMessage.data.payload.body?.data) {
          body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
        }

        // If no text/plain, try to use HTML (we'll parse it simply)
        if (!body && htmlBody) {
          console.log('⚠️ No text/plain found, using HTML body (length:', htmlBody.length, ')');
          // Simple HTML stripping - preserve structure with newlines
          body = htmlBody
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            // Convert block-level elements to newlines BEFORE removing tags
            .replace(/<\/?(div|p|br|tr|li|h[1-6])[^>]*>/gi, '\n')
            // Now remove remaining tags
            .replace(/<[^>]+>/g, ' ')
            // HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            // Clean up whitespace but preserve newlines
            .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
            .replace(/\n\s+/g, '\n')   // Remove leading spaces on lines
            .replace(/\s+\n/g, '\n')   // Remove trailing spaces on lines
            .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
            .trim();
        }

        if (!body) {
          console.log('⚠️ Could not extract any email body content');
        } else {
          console.log(`✅ Extracted email body (length: ${body.length} chars)`);
        }

        // Extract information from body
        const callTitle = extractCallTitle(body);
        const baseCustomerName = extractCustomerName(callTitle);
        const participants = extractParticipants(body);
        const gongUrl = extractGongUrl(body);
        const allNextSteps = extractAllNextSteps(body);

        // Combine customer name with participants
        const customerName = participants
          ? `${baseCustomerName} (${participants})`
          : baseCustomerName;

        console.log(`\n📧 Email ID: ${message.id}`);
        console.log(`📋 Subject: ${subject}`);
        console.log(`📝 Call Title: "${callTitle}"`);
        console.log(`🏢 Customer: "${customerName}"`);
        console.log(`👥 Participants: "${participants || '(not found)'}"`);
        console.log(`🔗 Gong URL: ${gongUrl || '(not found)'}`);
        console.log(`📊 Next Steps Found: ${allNextSteps.length}`);

        // If no next steps found, log a sample of the email body for debugging
        if (allNextSteps.length === 0) {
          console.log(`⚠️ No next steps found. Email body sample (first 1000 chars):`);
          console.log(body.substring(0, 1000));
          console.log(`\n--- End of sample ---\n`);
        }

        // Include all calls that have next steps
        if (allNextSteps.length > 0) {
          calls.push({
            emailId: message.id,
            subject,
            date,
            callTitle,
            customerName,
            gongUrl,
            nextSteps: allNextSteps,
            body: body.substring(0, 500) // First 500 chars for preview
          });
        }
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error);
      }
    }

    console.log(`✅ Found ${calls.length} Gong calls with next steps`);
    res.json({ calls });

  } catch (error: any) {
    console.error('❌ Error fetching Gong calls:', error);
    res.status(500).json({
      error: 'Failed to fetch Gong calls',
      details: error.message
    });
  }
});

// POST /api/gong/approve-tasks - Approve tasks from Gong call
router.post('/approve-tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const { emailId, tasks, accountOwnerEmail } = req.body;

    console.log('📝 Approve Gong tasks:', { emailId, taskCount: tasks?.length, accountOwnerEmail });

    if (!emailId || !tasks || !accountOwnerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // This endpoint will be implemented after we create the task approval flow
    // For now, just return success
    res.json({
      success: true,
      message: `${tasks.length} tasks queued for approval`
    });

  } catch (error: any) {
    console.error('❌ Error approving Gong tasks:', error);
    res.status(500).json({
      error: 'Failed to approve tasks',
      details: error.message
    });
  }
});

export default router;
