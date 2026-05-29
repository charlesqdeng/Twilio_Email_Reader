import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { appendApprovedTask, getApprovedTasks, removeApprovedTask, appendSolution } from '../services/sheets';

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

// POST /api/tasks/approve - Approve a task
router.post('/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const { taskId, taskTitle, customerName, customerEmail, emailFrom, emailTo, emailCc, emailSubject, priority, urgency, deadline } = req.body;

    console.log('📝 Approve task request:', { taskId, taskTitle, customerName, customerEmail });
    console.log('📧 Email participants:', { emailFrom, emailTo, emailCc });
    console.log('📧 Email subject:', emailSubject);

    if (!taskId || !taskTitle || !customerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if we have tokens
    if (!req.session.tokens) {
      console.error('❌ No OAuth tokens in session');
      return res.status(401).json({ error: 'Not authenticated - please log out and log back in' });
    }

    console.log('🔑 Creating authenticated OAuth client');
    // Create OAuth client with both credentials and user tokens
    const authClient = createAuthenticatedClient(req.session.tokens!);

    // Get both customer email and logged-in user email
    const emailToStore = customerEmail || 'unknown';
    const approvedByEmail = req.session.userProfile?.primary_email || 'unknown';
    console.log('👤 Customer email:', emailToStore);
    console.log('👤 Approved by:', approvedByEmail);

    console.log('📊 Attempting to write to Google Sheets...');
    // Append to Google Sheet (pass email participants for routing)
    const sheetUrl = await appendApprovedTask(authClient, {
      taskTitle,
      customerName,
      deadline: deadline || 'None',
      status: 'Open', // New tasks default to "Open" status
      approvedAt: new Date().toISOString(),
      customerEmail: emailToStore,
      approvedBy: approvedByEmail,
      emailFrom: emailFrom || '',
      emailTo: emailTo || '',
      emailCc: emailCc || '',
      emailSubject: emailSubject || ''
    });

    console.log('✅ Task approved successfully');
    res.json({ success: true, message: 'Task approved and saved to Google Sheets', sheetUrl });
  } catch (error: any) {
    console.error('❌ Error approving task:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to approve task',
      details: error.message,
      code: error.code
    });
  }
});

// POST /api/tasks/unapprove - Unapprove a task
router.post('/unapprove', requireAuth, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    // Create OAuth client with both credentials and user tokens
    const authClient = createAuthenticatedClient(req.session.tokens!);

    // Get user email from session
    const userEmail = req.session.userProfile?.primary_email || 'unknown';

    // Remove from Google Sheet
    await removeApprovedTask(authClient, taskId, userEmail);

    res.json({ success: true, message: 'Task unapproved and removed from Google Sheets' });
  } catch (error: any) {
    console.error('Error unapproving task:', error);
    res.status(500).json({ error: 'Failed to unapprove task', details: error.message });
  }
});

// GET /api/tasks/test - Test Google Sheets access
router.get('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const authClient = createAuthenticatedClient(req.session.tokens!);
    const drive = google.drive({ version: 'v3', auth: authClient });

    console.log('Testing Google Drive access...');
    const test = await drive.files.list({ pageSize: 1 });

    res.json({
      success: true,
      message: 'Google Sheets/Drive access is working!',
      fileCount: test.data.files?.length || 0
    });
  } catch (error: any) {
    console.error('Test failed:', error);
    res.status(500).json({
      error: 'Google Sheets/Drive access failed',
      details: error.message,
      hint: 'You may need to log out and log back in to grant new permissions'
    });
  }
});

// GET /api/tasks/approved - Get all approved tasks for current user
router.get('/approved', requireAuth, async (req: Request, res: Response) => {
  try {
    // Create OAuth client with both credentials and user tokens
    const authClient = createAuthenticatedClient(req.session.tokens!);

    // Get user email from session
    const userEmail = req.session.userProfile?.primary_email || 'unknown';

    // Get approved tasks from Google Sheet
    const { tasks, sheetUrl } = await getApprovedTasks(authClient, userEmail);

    res.json({ approvedTasks: tasks, sheetUrl });
  } catch (error: any) {
    console.error('Error getting approved tasks:', error);
    res.status(500).json({ error: 'Failed to get approved tasks', details: error.message });
  }
});

// POST /api/tasks/save-solution - Save a solution from sent email
router.post('/save-solution', requireAuth, async (req: Request, res: Response) => {
  try {
    const { emailId, sentDate, recipient, customerName, subject, solutionProvided } = req.body;

    console.log('💡 Save solution request:', { emailId, recipient, customerName });

    if (!emailId || !recipient || !customerName || !solutionProvided) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if we have tokens
    if (!req.session.tokens) {
      console.error('❌ No OAuth tokens in session');
      return res.status(401).json({ error: 'Not authenticated - please log out and log back in' });
    }

    console.log('🔑 Creating authenticated OAuth client');
    const authClient = createAuthenticatedClient(req.session.tokens!);

    // Get user email from session
    const userEmail = req.session.userProfile?.primary_email || 'unknown';
    console.log('👤 User email:', userEmail);

    console.log('📊 Attempting to write solution to Google Sheets...');
    const sheetUrl = await appendSolution(authClient, {
      emailId,
      sentDate: sentDate || new Date().toISOString(),
      recipient,
      customerName,
      subject: subject || '',
      solutionProvided,
      savedAt: new Date().toISOString(),
      userEmail
    });

    console.log('✅ Solution saved successfully');
    res.json({ success: true, message: 'Solution saved to Google Sheets', sheetUrl });
  } catch (error: any) {
    console.error('❌ Error saving solution:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to save solution',
      details: error.message,
      code: error.code
    });
  }
});

export default router;
