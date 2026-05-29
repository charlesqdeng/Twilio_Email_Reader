import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readUserConfig } from '../config/userConfig';

const SPREADSHEET_NAME = 'Email Reader - Task Approvals';
const SHEET_NAME = 'Approved Tasks';
const SOLUTIONS_SHEET_NAME = 'Solutions';

// Load account owner to spreadsheet mappings from user config
function getAccountOwnerSpreadsheets(): Record<string, string> {
  const config = readUserConfig();
  if (!config?.approved_tasks_sheets) {
    return {};
  }

  // Build mapping: email -> sheet ID
  const mapping: Record<string, string> = {};

  // First, create a map of owner name -> owner email
  const ownerNameToEmail: Record<string, string> = {};
  if (config.account_owners) {
    for (const owner of config.account_owners) {
      ownerNameToEmail[owner.name] = owner.email;
    }
  }

  // Now map email -> sheet ID
  for (const sheet of config.approved_tasks_sheets) {
    const ownerEmail = ownerNameToEmail[sheet.owner];
    if (ownerEmail) {
      mapping[ownerEmail.toLowerCase()] = sheet.id;
    }
  }

  return mapping;
}

// Spreadsheets that use custom column structure (pre-existing sheets)
// Maps spreadsheet ID to their existing "Approved Tasks" sheet name and column count
function getCustomStructureSheets(): Record<string, { sheetName: string; columns: number }> {
  const config = readUserConfig();
  if (!config?.approved_tasks_sheets) {
    return {};
  }

  const mapping: Record<string, { sheetName: string; columns: number }> = {};
  for (const sheet of config.approved_tasks_sheets) {
    // Default to 8 columns if using approved_tasks_sheets from config
    mapping[sheet.id] = {
      sheetName: sheet.name,
      columns: 8 // Assume 8-column structure for configured sheets
    };
  }

  return mapping;
}

interface ApprovedTask {
  taskTitle: string;
  customerName: string;
  deadline: string;
  status: string; // e.g., "Open", "In Progress", "Completed", "Blocked"
  approvedAt: string;
  customerEmail: string;
  approvedBy: string;
  emailFrom?: string;     // Email sender (for routing)
  emailTo?: string;       // Email To field (for routing)
  emailCc?: string;       // Email CC field (for routing)
  emailSubject?: string;  // Email subject (for Details column)
}

interface Solution {
  emailId: string;
  sentDate: string;
  recipient: string;
  customerName: string;
  subject: string;
  solutionProvided: string;
  savedAt: string;
  userEmail: string;
}

// Helper function to format date/time as "YYYY-MM-DD HH:MM"
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Ensure the spreadsheet has the correct structure (sheets and headers)
async function ensureSheetStructure(auth: OAuth2Client, spreadsheetId: string): Promise<void> {
  // Check if this spreadsheet uses a custom structure
  const customStructureSheets = getCustomStructureSheets();
  const isCustomStructure = !!customStructureSheets[spreadsheetId];

  if (isCustomStructure) {
    console.log('✅ Spreadsheet uses custom structure, skipping structure verification');
    // For custom structure sheets, just verify the "Approved Tasks" sheet exists
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });

    const customConfig = customStructureSheets[spreadsheetId];
    const existingSheets = spreadsheet.data.sheets || [];
    const approvedTasksSheet = existingSheets.find(
      sheet => sheet.properties?.title === customConfig.sheetName
    );

    if (!approvedTasksSheet) {
      throw new Error(`Custom sheet "${customConfig.sheetName}" not found in spreadsheet ${spreadsheetId}`);
    }

    console.log('✅ Custom "Approved Tasks" sheet found:', customConfig.sheetName);
    return;
  }

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Get spreadsheet metadata to check existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const approvedTasksSheet = existingSheets.find(
      sheet => sheet.properties?.title === SHEET_NAME
    );
    const solutionsSheet = existingSheets.find(
      sheet => sheet.properties?.title === SOLUTIONS_SHEET_NAME
    );

    // If Approved Tasks sheet doesn't exist, create it
    if (!approvedTasksSheet) {
      console.log('📝 Creating Approved Tasks sheet...');
      const maxSheetId = Math.max(...existingSheets.map(s => s.properties?.sheetId || 0));
      const newSheetId = maxSheetId + 1;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_NAME,
                  sheetId: newSheetId
                }
              }
            }
          ]
        }
      });

      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Customer Name', 'Status', 'Customer Contact', 'Task Title', 'Approved By', 'Approved At', 'Deadline']]
        }
      });

      // Format header row and add data validation
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.3, blue: 0.5 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            },
            {
              setDataValidation: {
                range: {
                  sheetId: newSheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 1,
                  endColumnIndex: 2
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Open' },
                      { userEnteredValue: 'In Progress' },
                      { userEnteredValue: 'Completed' },
                      { userEnteredValue: 'Blocked' },
                      { userEnteredValue: 'On Hold' }
                    ]
                  },
                  showCustomUi: true,
                  strict: false
                }
              }
            }
          ]
        }
      });
    }

    // Ensure Solutions sheet exists
    if (!solutionsSheet) {
      await ensureSolutionsSheet(auth, spreadsheetId);
    }

    console.log('✅ Sheet structure verified');
  } catch (error) {
    console.error('❌ Error ensuring sheet structure:', error);
    throw error;
  }
}

// Ensure Solutions sheet exists in the spreadsheet
async function ensureSolutionsSheet(auth: OAuth2Client, spreadsheetId: string): Promise<void> {
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Get spreadsheet metadata to check existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const solutionsSheetExists = existingSheets.some(
      sheet => sheet.properties?.title === SOLUTIONS_SHEET_NAME
    );

    if (solutionsSheetExists) {
      console.log('✅ Solutions sheet already exists');
      return;
    }

    console.log('📝 Creating Solutions sheet...');

    // Find next available sheet ID
    const maxSheetId = Math.max(...existingSheets.map(s => s.properties?.sheetId || 0));
    const newSheetId = maxSheetId + 1;

    // Create the Solutions sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SOLUTIONS_SHEET_NAME,
                sheetId: newSheetId
              }
            }
          }
        ]
      }
    });

    // Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SOLUTIONS_SHEET_NAME}!A1:H1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Email ID', 'Sent Date', 'Recipient', 'Customer Name', 'Subject', 'Solution Provided', 'Saved At', 'User Email']]
      }
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: newSheetId,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.3 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }
        ]
      }
    });

    console.log('✅ Solutions sheet created successfully');
  } catch (error) {
    console.error('❌ Error ensuring Solutions sheet:', error);
    throw error;
  }
}

// Helper to extract all email addresses from a comma-separated field
function extractAllEmailAddresses(emailField: string): string[] {
  if (!emailField) return [];

  // Split by comma and extract email from each "Name <email>" or bare email
  return emailField.split(',').map(part => {
    const trimmed = part.trim();
    const match = trimmed.match(/<(.+?)>/);
    return match ? match[1].toLowerCase() : trimmed.toLowerCase();
  }).filter(email => email.length > 0);
}

// Determine which spreadsheet to use based on email participants
// Checks if any account owner is involved (sender, To, or CC)
function getSpreadsheetIdForEmail(fromEmail: string, toEmails: string, ccEmails: string): string | null {
  console.log('🔍 getSpreadsheetIdForEmail called with:');
  console.log('   From:', fromEmail);
  console.log('   To:', toEmails);
  console.log('   CC:', ccEmails);

  const accountOwnerSpreadsheets = getAccountOwnerSpreadsheets();

  // Extract all participant emails
  const fromAddr = extractAllEmailAddresses(fromEmail)[0] || '';
  const toAddrs = extractAllEmailAddresses(toEmails);
  const ccAddrs = extractAllEmailAddresses(ccEmails);

  console.log('📧 Extracted participants:');
  console.log('   From address:', fromAddr);
  console.log('   To addresses:', toAddrs);
  console.log('   CC addresses:', ccAddrs);

  // Combine all participants
  const allParticipants = [fromAddr, ...toAddrs, ...ccAddrs];
  console.log('👥 All participants:', allParticipants);
  console.log('🔑 Account owner emails to match:', Object.keys(accountOwnerSpreadsheets));

  // Check if any account owner is in the participants
  for (const participant of allParticipants) {
    console.log(`   Checking: "${participant}" against account owners...`);
    if (accountOwnerSpreadsheets[participant]) {
      console.log(`✅ Found account owner in email: ${participant}`);
      return accountOwnerSpreadsheets[participant];
    }
  }

  console.log('❌ No account owner found in participants');
  return null;
}

// Get or create the Google Sheet for task approvals
// Checks if any account owner is involved in the email (sender, To, or CC)
// If found, uses their specific sheet; otherwise falls back to default
async function getOrCreateSpreadsheet(auth: OAuth2Client, emailFrom?: string, emailTo?: string, emailCc?: string): Promise<string> {
  // Check if any account owner is involved in this email
  if (emailFrom || emailTo || emailCc) {
    const spreadsheetId = getSpreadsheetIdForEmail(
      emailFrom || '',
      emailTo || '',
      emailCc || ''
    );

    if (spreadsheetId) {
      console.log('✅ Using account owner spreadsheet:', spreadsheetId);

      // Ensure the sheet has proper structure
      try {
        await ensureSheetStructure(auth, spreadsheetId);
      } catch (error) {
        console.error('❌ Error ensuring sheet structure:', error);
        throw error;
      }

      return spreadsheetId;
    }
  }

  console.log('🔍 Searching for default spreadsheet...');
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Search for existing spreadsheet
    const searchResponse = await drive.files.list({
      q: `name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const spreadsheetId = searchResponse.data.files[0].id!;
      console.log('✅ Found existing spreadsheet:', spreadsheetId);

      // Ensure Solutions sheet exists (for backward compatibility)
      await ensureSolutionsSheet(auth, spreadsheetId);

      return spreadsheetId;
    }
  } catch (error) {
    console.error('❌ Error searching for spreadsheet:', error);
    throw error;
  }

  // Create new spreadsheet
  console.log('📝 Creating new spreadsheet...');
  try {
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: SPREADSHEET_NAME
        },
        sheets: [
          {
            properties: {
              title: SHEET_NAME,
              sheetId: 0
            }
          },
          {
            properties: {
              title: SOLUTIONS_SHEET_NAME,
              sheetId: 1
            }
          }
        ]
      }
    });

    const spreadsheetId = createResponse.data.spreadsheetId!;
    console.log('✅ Created spreadsheet:', spreadsheetId);

    // Add header row for Approved Tasks
    console.log('📝 Adding header rows...');
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${SHEET_NAME}!A1:G1`,
            values: [['Customer Name', 'Status', 'Customer Contact', 'Task Title', 'Approved By', 'Approved At', 'Deadline']]
          },
          {
            range: `${SOLUTIONS_SHEET_NAME}!A1:H1`,
            values: [['Email ID', 'Sent Date', 'Recipient', 'Customer Name', 'Subject', 'Solution Provided', 'Saved At', 'User Email']]
          }
        ]
      }
    });

    // Format header rows and add data validation for Status column
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Format Approved Tasks header row
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.3, blue: 0.5 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Format Solutions sheet header row
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.3 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Add data validation dropdown for Status column (column B, rows 2+)
          {
            setDataValidation: {
              range: {
                sheetId: 0,
                startRowIndex: 1, // Start from row 2 (after header)
                endRowIndex: 1000, // Apply to first 1000 rows
                startColumnIndex: 1, // Column B (Status)
                endColumnIndex: 2 // Column B only
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: [
                    { userEnteredValue: 'Open' },
                    { userEnteredValue: 'In Progress' },
                    { userEnteredValue: 'Completed' },
                    { userEnteredValue: 'Blocked' },
                    { userEnteredValue: 'On Hold' }
                  ]
                },
                showCustomUi: true,
                strict: false // Allow custom values if needed
              }
            }
          }
        ]
      }
    });

    return spreadsheetId;
  } catch (error) {
    console.error('❌ Error creating spreadsheet:', error);
    throw error;
  }
}

// Append an approved task to the sheet
export async function appendApprovedTask(
  auth: OAuth2Client,
  task: ApprovedTask
): Promise<string> {
  console.log('📊 appendApprovedTask called with:', task.taskTitle);
  console.log('👤 Customer email:', task.customerEmail);
  console.log('📧 Email participants - From:', task.emailFrom, 'To:', task.emailTo, 'CC:', task.emailCc);
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = await getOrCreateSpreadsheet(auth, task.emailFrom, task.emailTo, task.emailCc);

    console.log('📝 Appending task to spreadsheet:', spreadsheetId);

    // Check if this spreadsheet uses custom structure
    const customStructureSheets = getCustomStructureSheets();
    const customConfig = customStructureSheets[spreadsheetId];
    const isCustomStructure = !!customConfig;
    const sheetName = isCustomStructure ? customConfig.sheetName : SHEET_NAME;
    const columnCount = isCustomStructure ? customConfig.columns : 7;

    // Format dates
    const formattedDeadline = task.deadline && task.deadline !== 'None'
      ? formatDateTime(task.deadline)
      : 'None';
    const formattedApprovedAt = formatDateTime(task.approvedAt);

    // Format date for custom structure (MM/DD/YYYY instead of YYYY-MM-DD HH:MM)
    const formattedApprovedAtCustom = new Date(task.approvedAt).toLocaleDateString('en-US');
    const formattedDeadlineCustom = task.deadline && task.deadline !== 'None'
      ? new Date(task.deadline).toLocaleDateString('en-US')
      : '';

    if (isCustomStructure) {
      console.log('📝 Using custom structure for sheet:', sheetName, `(${columnCount} columns)`);

      if (columnCount === 8) {
        // 8-column structure: Customer Name, Status, Contact Info, Action Items, Owner, Enter Date, Deadline, Details
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:H`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              [
                task.customerName,           // Column A - Customer Name
                task.status || 'Open',       // Column B - Status
                task.customerEmail,          // Column C - Contact Info
                task.taskTitle,              // Column D - Action Items
                task.approvedBy,             // Column E - Owner
                formattedApprovedAtCustom,   // Column F - Enter Date (formatted as MM/DD/YYYY)
                formattedDeadlineCustom,     // Column G - Deadline (formatted as MM/DD/YYYY)
                task.emailSubject || ''      // Column H - Details (email subject)
              ]
            ]
          }
        });
      } else {
        // 7-column structure: Customer Name, Status, Contact Info, Action Items, Owner, Enter Date, Follow Date
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:G`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              [
                task.customerName,           // Column A - Customer Name
                task.status || 'Open',       // Column B - Status
                task.customerEmail,          // Column C - Contact Info
                task.taskTitle,              // Column D - Action Items
                task.approvedBy,             // Column E - Owner
                formattedApprovedAtCustom,   // Column F - Enter Date (formatted as MM/DD/YYYY)
                formattedDeadlineCustom      // Column G - Follow Date (formatted as MM/DD/YYYY)
              ]
            ]
          }
        });
      }
    } else {
      console.log('📝 Using default structure for sheet:', sheetName);
      // Default structure: Customer Name, Status, Customer Contact, Task Title, Approved By, Approved At, Deadline
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:G`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              task.customerName,         // Column A - Customer Name
              task.status || 'Open',     // Column B - Status
              task.customerEmail,        // Column C - Customer Contact
              task.taskTitle,            // Column D - Task Title
              task.approvedBy,           // Column E - Approved By
              formattedApprovedAt,       // Column F - Approved At (formatted)
              formattedDeadline          // Column G - Deadline (formatted)
            ]
          ]
        }
      });
    }
    console.log('✅ Task appended successfully');

    // Return the spreadsheet URL
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } catch (error) {
    console.error('❌ Error in appendApprovedTask:', error);
    throw error;
  }
}

// Get all approved tasks for a user (from all account owner spreadsheets + default sheet)
export async function getApprovedTasks(
  auth: OAuth2Client,
  userEmail: string
): Promise<{ tasks: ApprovedTask[], sheetUrl: string }> {
  const sheets = google.sheets({ version: 'v4', auth });
  const allTasks: ApprovedTask[] = [];

  try {
    const accountOwnerSpreadsheets = getAccountOwnerSpreadsheets();
    const customStructureSheets = getCustomStructureSheets();

    // Get list of all spreadsheet IDs to check
    const spreadsheetIdsToCheck = [
      ...Object.values(accountOwnerSpreadsheets), // Account owner sheets
      await getOrCreateSpreadsheet(auth) // Default sheet
    ];

    // Query each spreadsheet
    for (const spreadsheetId of spreadsheetIdsToCheck) {
      try {
        // Determine sheet name and column count
        const customConfig = customStructureSheets[spreadsheetId];
        const isCustomStructure = !!customConfig;
        const sheetName = isCustomStructure ? customConfig.sheetName : SHEET_NAME;
        const columnCount = isCustomStructure ? customConfig.columns : 7;

        // Adjust range based on column count
        const range = columnCount === 8 ? `${sheetName}!A2:H` : `${sheetName}!A2:G`;

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range
        });

        const rows = response.data.values || [];

        // Filter tasks for this user (by who approved it)
        const tasksFromSheet = rows
          .filter(row => row[4] === userEmail) // Filter by approved by (column E)
          .map(row => {
            if (columnCount === 8) {
              // 8-column structure: A=Customer, B=Status, C=Contact, D=Action, E=Owner, F=Enter, G=Deadline, H=Details
              return {
                customerName: row[0] || '',
                status: row[1] || 'Open',
                customerEmail: row[2] || '',
                taskTitle: row[3] || '',
                approvedBy: row[4] || '',
                approvedAt: row[5] || '',
                deadline: row[6] || ''  // Column G - Deadline
              };
            } else {
              // 7-column structure: A=Customer, B=Status, C=Contact, D=Action, E=Owner, F=Enter, G=Follow
              return {
                customerName: row[0] || '',
                status: row[1] || 'Open',
                customerEmail: row[2] || '',
                taskTitle: row[3] || '',
                approvedBy: row[4] || '',
                approvedAt: row[5] || '',
                deadline: row[6] || ''  // Column G - Follow Date
              };
            }
          });

        allTasks.push(...tasksFromSheet);
      } catch (error) {
        // If a specific sheet is not accessible, log and continue
        console.warn(`⚠️ Could not read from spreadsheet ${spreadsheetId}:`, error);
      }
    }

    // Return the default sheet URL (or the first account owner sheet)
    const defaultSheetId = await getOrCreateSpreadsheet(auth);
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${defaultSheetId}/edit`;

    return { tasks: allTasks, sheetUrl };
  } catch (error) {
    console.error('Error reading approved tasks:', error);
    return { tasks: [], sheetUrl: '' };
  }
}

// Remove an approved task from the sheet (searches across all spreadsheets)
export async function removeApprovedTask(
  auth: OAuth2Client,
  taskId: string,
  userEmail: string
): Promise<void> {
  const sheets = google.sheets({ version: 'v4', auth });

  const accountOwnerSpreadsheets = getAccountOwnerSpreadsheets();
  const customStructureSheets = getCustomStructureSheets();

  // Get list of all spreadsheet IDs to check
  const spreadsheetIdsToCheck = [
    ...Object.values(accountOwnerSpreadsheets), // Account owner sheets
    await getOrCreateSpreadsheet(auth) // Default sheet
  ];

  // Search each spreadsheet for the task
  for (const spreadsheetId of spreadsheetIdsToCheck) {
    try {
      // Determine sheet name and column count
      const customConfig = customStructureSheets[spreadsheetId];
      const isCustomStructure = !!customConfig;
      const sheetName = isCustomStructure ? customConfig.sheetName : SHEET_NAME;
      const columnCount = isCustomStructure ? customConfig.columns : 7;

      // Adjust range based on column count
      const range = columnCount === 8 ? `${sheetName}!A2:H` : `${sheetName}!A2:G`;

      // Get all rows
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      const rows = response.data.values || [];

      // Find the row index to delete
      // taskId is actually the unique identifier (customer-taskTitle combination)
      // We'll match by task title (column D, index 3) and approved by (column E, index 4)
      const rowIndex = rows.findIndex(row => {
        const taskTitle = row[3] || '';
        const approvedBy = row[4] || '';
        // taskId format is "customerName-taskTitle", extract the taskTitle part
        const taskTitleFromId = taskId.split('-').slice(1).join('-');
        return taskTitle === taskTitleFromId && approvedBy === userEmail;
      });

      if (rowIndex === -1) continue; // Not in this sheet, try next one

      const actualRowIndex = rowIndex + 2; // +2 for header and 0-based index

      // Get sheet metadata to find the correct sheetId
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });

      const approvedTasksSheet = spreadsheet.data.sheets?.find(
        sheet => sheet.properties?.title === sheetName
      );

      if (!approvedTasksSheet) continue;

      const sheetId = approvedTasksSheet.properties?.sheetId || 0;

      // Delete the row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: actualRowIndex - 1,
                  endIndex: actualRowIndex
                }
              }
            }
          ]
        }
      });

      console.log(`✅ Task removed from spreadsheet: ${spreadsheetId}`);
      return; // Task found and deleted, exit
    } catch (error) {
      console.warn(`⚠️ Could not check/remove from spreadsheet ${spreadsheetId}:`, error);
    }
  }

  console.warn('⚠️ Task not found in any spreadsheet');
}

// Append a solution to the Solutions sheet
export async function appendSolution(
  auth: OAuth2Client,
  solution: Solution
): Promise<string> {
  console.log('📊 appendSolution called for:', solution.recipient);
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = await getOrCreateSpreadsheet(auth);

    console.log('📝 Appending solution to spreadsheet:', spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SOLUTIONS_SHEET_NAME}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            solution.emailId,
            solution.sentDate,
            solution.recipient,
            solution.customerName,
            solution.subject,
            solution.solutionProvided,
            solution.savedAt,
            solution.userEmail
          ]
        ]
      }
    });
    console.log('✅ Solution appended successfully');

    // Return the spreadsheet URL with the Solutions sheet selected
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=1`;
  } catch (error) {
    console.error('❌ Error in appendSolution:', error);
    throw error;
  }
}
