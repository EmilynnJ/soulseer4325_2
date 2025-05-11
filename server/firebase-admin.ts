import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Initialize Firebase Admin SDK
 * 
 * This module sets up the Firebase Admin SDK for server-side operations,
 * loading credentials either from environment variables or a service account JSON file.
 */

// Initialize credential object
let credential: admin.credential.Credential;

// Check if FIREBASE_SERVICE_ACCOUNT is provided as an environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // If the env var contains JSON content directly
    const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccountJson);
  } catch (error) {
    // If the env var is a path to a JSON file
    console.log('FIREBASE_SERVICE_ACCOUNT is not valid JSON, trying as file path...');
    try {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        credential = admin.credential.cert(serviceAccountJson);
      } else {
        throw new Error(`Service account file not found at: ${serviceAccountPath}`);
      }
    } catch (fileError) {
      console.error('Failed to load Firebase service account:', fileError);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT environment variable');
    }
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Use Google Application Default Credentials if available
  credential = admin.credential.applicationDefault();
} else {
  // Check for a local service account file as fallback
  const localServiceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
  
  if (fs.existsSync(localServiceAccountPath)) {
    try {
      const serviceAccountJson = JSON.parse(fs.readFileSync(localServiceAccountPath, 'utf8'));
      credential = admin.credential.cert(serviceAccountJson);
    } catch (error) {
      console.error('Failed to load local service account file:', error);
      throw new Error('Invalid service account file');
    }
  } else {
    throw new Error('Firebase credentials not found. Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide a service account JSON file.');
  }
}

// Get database URL from environment or construct from project ID
const databaseURL = process.env.FIREBASE_DATABASE_URL || 
  `https://${process.env.FIREBASE_PROJECT_ID || (credential as any).projectId}.firebaseio.com`;

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential,
  databaseURL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

// Export the admin instance and commonly used services
export { admin };
export const auth = admin.auth();
export const db = admin.database();
export const firestore = admin.firestore();
export const storageService = admin.storage();
export const messagingService = admin.messaging();

console.log('Firebase Admin SDK initialized successfully');
