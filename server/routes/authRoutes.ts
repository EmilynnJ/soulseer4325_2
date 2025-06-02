import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { findUserByEmail, createUser } from '../services/userService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ message: 'Missing fields' });

  const exists = await findUserByEmail(email);
  if (exists) return res.status(409).json({ message: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const newUser = await createUser(email, hashed, role);

  const token = jwt.sign({ id: newUser.id, email, role }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user: { id: newUser.id, email, role }, token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: user.id, email: user.email, role: user.role }, token });
});

export default router;
