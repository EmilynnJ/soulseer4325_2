import { Client, Account, Teams } from 'appwrite';

/**
 * Initialize Appwrite Admin SDK with credentials from environment variables
 */
export function initializeAppwrite() {
  try {
    // Initialize with environment variables
    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject('681831b30038fbc171cf');
    
    console.log('Appwrite Admin SDK initialized successfully');
    
    return {
      client,
      account: new Account(client),
      teams: new Teams(client)
    };
  } catch (error) {
    console.error('Failed to initialize Appwrite Admin:', error);
    console.log('Continuing without Appwrite Admin functionality');
    return null;
  }
}

// Initialize Appwrite services
const appwrite = initializeAppwrite();

// Export the Appwrite services
export const client = appwrite?.client;
export const account = appwrite?.account;
export const teams = appwrite?.teams;

// Admin configuration
export const adminConfig = {
    apiKey: 'standard_31cbb4cd916d4b64842d4241add0e5f83ef8e030128be966f6bcb0ec59219a11121b8f027c60bb5da16167650b1076ad762809563804448d39c38ce85a5e0e2dbf5de2dc209988170a12c40037b9fea2527c8556ae1b287c7e66a165df8f2bd32f220280e6537bd16c8e357bec3f539490ad27632f8ffa3fd7b4a19dabe384df'
};