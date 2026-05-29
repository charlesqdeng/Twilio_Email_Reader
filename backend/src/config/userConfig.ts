import fs from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.resolve(process.cwd(), '.user-config.json');

export interface AccountOwner {
  name: string;
  email: string;
}

export interface ApprovedTasksSheet {
  id: string;        // Google Sheet ID
  name: string;      // Sheet name (usually "Approved Tasks")
  owner: string;     // Owner name (must match an account owner)
}

export interface UserConfig {
  first_name: string;
  last_name: string;
  primary_email: string;
  internal_domain: string;
  account_owners?: AccountOwner[]; // Optional: List of account owners for Gong call routing
  approved_tasks_sheets?: ApprovedTasksSheet[]; // Optional: Google Sheets for approved tasks per owner
}

// Check if config file exists
export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE_PATH);
}

// Read user config from file
export function readUserConfig(): UserConfig | null {
  try {
    if (!configExists()) {
      return null;
    }

    const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const config = JSON.parse(data);

    // Validate required fields
    if (!config.first_name || !config.last_name || !config.primary_email || !config.internal_domain) {
      console.warn('Invalid config file format');
      return null;
    }

    return config as UserConfig;
  } catch (error) {
    console.error('Error reading user config:', error);
    return null;
  }
}

// Write user config to file
export function writeUserConfig(config: UserConfig): void {
  try {
    const data = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_FILE_PATH, data, 'utf-8');
    console.log('✅ User config saved to', CONFIG_FILE_PATH);
  } catch (error) {
    console.error('Error writing user config:', error);
    throw new Error('Failed to save user configuration');
  }
}

// Delete user config file
export function deleteUserConfig(): void {
  try {
    if (configExists()) {
      fs.unlinkSync(CONFIG_FILE_PATH);
      console.log('✅ User config deleted');
    }
  } catch (error) {
    console.error('Error deleting user config:', error);
    throw new Error('Failed to delete user configuration');
  }
}

// Get config file path (for info purposes)
export function getConfigFilePath(): string {
  return CONFIG_FILE_PATH;
}
