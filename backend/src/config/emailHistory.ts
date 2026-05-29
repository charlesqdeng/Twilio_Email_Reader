import fs from 'fs';
import path from 'path';

const HISTORY_FILE_PATH = path.resolve(process.cwd(), '.email-history.json');

export interface ProcessedEmail {
  emailId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  snippet: string;
  company_name: string;
  is_external: boolean;
  category: string;
  priority: string;
  actionable: boolean;
  summary: string;
  tasks: Array<{
    title: string;
    deadline: string;
    urgency: string;
  }>;
  stakeholders: string[];
  sentiment: string;
  keywords: string[];
  processedAt: string; // When it was analyzed
}

export interface EmailHistory {
  userEmail: string;
  emails: ProcessedEmail[];
  lastFetchDate: string; // ISO date string
}

// Check if history file exists
export function historyExists(): boolean {
  return fs.existsSync(HISTORY_FILE_PATH);
}

// Read email history from file
export function readEmailHistory(): EmailHistory | null {
  try {
    if (!historyExists()) {
      return null;
    }

    const data = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
    const history = JSON.parse(data);

    return history as EmailHistory;
  } catch (error) {
    console.error('Error reading email history:', error);
    return null;
  }
}

// Write email history to file
export function writeEmailHistory(history: EmailHistory): void {
  try {
    const data = JSON.stringify(history, null, 2);
    fs.writeFileSync(HISTORY_FILE_PATH, data, 'utf-8');
    console.log('✅ Email history saved:', history.emails.length, 'emails');
  } catch (error) {
    console.error('Error writing email history:', error);
    throw new Error('Failed to save email history');
  }
}

// Add or update emails in history
export function addEmailsToHistory(
  userEmail: string,
  newEmails: ProcessedEmail[],
  lastFetchDate: string
): void {
  let history = readEmailHistory();

  if (!history || history.userEmail !== userEmail) {
    // Create new history for this user
    history = {
      userEmail,
      emails: newEmails,
      lastFetchDate
    };
  } else {
    // Merge with existing history
    const existingIds = new Set(history.emails.map(e => e.emailId));

    // Add only new emails (avoid duplicates)
    const uniqueNewEmails = newEmails.filter(e => !existingIds.has(e.emailId));

    history.emails = [...history.emails, ...uniqueNewEmails];
    history.lastFetchDate = lastFetchDate;
  }

  writeEmailHistory(history);
}

// Get emails from history for a date range
export function getEmailsFromHistory(
  userEmail: string,
  startDate?: string,
  endDate?: string
): ProcessedEmail[] {
  const history = readEmailHistory();

  if (!history || history.userEmail !== userEmail) {
    return [];
  }

  let emails = history.emails;

  // Filter by date range if provided
  if (startDate || endDate) {
    emails = emails.filter(email => {
      const emailDate = new Date(email.date);

      if (startDate && emailDate < new Date(startDate)) {
        return false;
      }

      if (endDate && emailDate > new Date(endDate)) {
        return false;
      }

      return true;
    });
  }

  return emails;
}

// Check which email IDs are already processed
export function getProcessedEmailIds(userEmail: string): Set<string> {
  const history = readEmailHistory();

  if (!history || history.userEmail !== userEmail) {
    return new Set();
  }

  return new Set(history.emails.map(e => e.emailId));
}

// Get last fetch date
export function getLastFetchDate(userEmail: string): string | null {
  const history = readEmailHistory();

  if (!history || history.userEmail !== userEmail) {
    return null;
  }

  return history.lastFetchDate;
}

// Delete email history
export function deleteEmailHistory(): void {
  try {
    if (historyExists()) {
      fs.unlinkSync(HISTORY_FILE_PATH);
      console.log('✅ Email history deleted');
    }
  } catch (error) {
    console.error('Error deleting email history:', error);
    throw new Error('Failed to delete email history');
  }
}

// Get history file path
export function getHistoryFilePath(): string {
  return HISTORY_FILE_PATH;
}

// Get history stats
export function getHistoryStats(userEmail: string): {
  totalEmails: number;
  dateRange: { oldest: string; newest: string } | null;
  lastFetch: string | null;
} {
  const history = readEmailHistory();

  if (!history || history.userEmail !== userEmail) {
    return {
      totalEmails: 0,
      dateRange: null,
      lastFetch: null
    };
  }

  const dates = history.emails.map(e => new Date(e.date)).sort((a, b) => a.getTime() - b.getTime());

  return {
    totalEmails: history.emails.length,
    dateRange: dates.length > 0 ? {
      oldest: dates[0].toISOString(),
      newest: dates[dates.length - 1].toISOString()
    } : null,
    lastFetch: history.lastFetchDate
  };
}
