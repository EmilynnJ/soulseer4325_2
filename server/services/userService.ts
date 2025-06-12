import { pool } from '../db';
import { users } from '@shared/schema';
import { type User } from '@shared/schema';

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return res.rows[0] || null;
};

export const createUser = async (email: string, hashedPassword: string, role: string): Promise<User> => {
  const res = await pool.query(
    'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
    [email, hashedPassword, role]
  );
  return res.rows[0];
};

