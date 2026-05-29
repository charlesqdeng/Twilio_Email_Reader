import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as readline from 'readline';
import { readUserConfig } from '../config/userConfig';

// Load sheets from user configuration
function loadSheetsFromConfig() {
  const config = readUserConfig();

  if (!config || !config.approved_tasks_sheets || config.approved_tasks_sheets.length === 0) {
    console.error('❌ No approved_tasks_sheets found in .user-config.json');
    console.log('\nPlease add approved_tasks_sheets to your .user-config.json:');
    console.log(`
{
  "approved_tasks_sheets": [
    { "id": "YOUR_SHEET_ID", "name": "Approved Tasks", "owner": "Owner Name" }
  ]
}
    `);
    process.exit(1);
  }

  return config.approved_tasks_sheets;
}

// Spreadsheet IDs and their sheet names (loaded from config)
const SHEETS_TO_UPDATE = loadSheetsFromConfig();

async function updateColumnHeaders() {
  console.log('🔧 Column Header Update Script');
  console.log('================================\n');

  console.log('This script will update column H1 from "Follow Date" to "Details" in all 4 sheets:\n');
  SHEETS_TO_UPDATE.forEach(sheet => {
    console.log(`  - ${sheet.owner}'s sheet`);
  });

  console.log('\n⚠️  WARNING: This will modify existing spreadsheets!');
  console.log('Make sure you have backups or can undo if needed.\n');

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Do you want to proceed? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Aborted. No changes made.');
    return;
  }

  console.log('\n🚀 Starting update...\n');

  // Get OAuth client from session (you'll need to be authenticated)
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  console.log('❌ ERROR: This script requires authentication.');
  console.log('Please run this through the app with an authenticated session,');
  console.log('or manually update the headers in each sheet.');
  console.log('\nManual steps:');
  console.log('1. Open each spreadsheet');
  console.log('2. Go to "Approved Tasks" tab');
  console.log('3. Click cell H1');
  console.log('4. Change "Follow Date" to "Details"');
  console.log('5. Press Enter');
}

// Run the script
updateColumnHeaders().catch(console.error);
