import { config } from 'dotenv';
import { storage } from './storage';
import { hashPassword } from './auth';

// Load environment variables so DATABASE_URL and other values are available
config();

async function setupAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'changeMe123';
  const fullName = process.env.ADMIN_NAME || 'Admin';

  const existing = await storage.getUserByEmail(email);
  if (existing) {
    console.log('Admin user already exists');
    return;
  }

  const hashedPassword = await hashPassword(password);
  const user = await storage.createUser({
    email,
    hashedPassword,
    fullName,
    role: 'admin'
  });
  console.log(`Admin user created: ${user.email}`);
}

setupAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error creating admin user:', err);
    process.exit(1);
  });
