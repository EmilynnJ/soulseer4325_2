import express from "express";
import { db } from "../db";
import { premiumMessages, users } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// POST /api/premium-message: Send a reply (reader can set price, paid/free)
router.post("/api/premium-message", async (req, res) => {
  const { senderId, receiverId, message, price, isPaid } = req.body;
  if (!senderId || !receiverId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const data = {
    senderId,
    receiverId,
    message,
    isPaid: !!isPaid,
    price: price ? String(price) : null,
  };
  const [inserted] = await db.insert(premiumMessages).values(data).returning();
  return res.status(201).json(inserted);
});

// PATCH /api/premium-message/:id/price: Reader sets/toggles price on own reply
router.patch("/api/premium-message/:id/price", async (req, res) => {
  const { price, isPaid } = req.body;
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Missing id param" });
  const updated = await db.update(premiumMessages)
    .set({ price: price ? String(price) : null, isPaid: !!isPaid })
    .where(eq(premiumMessages.id, Number(id)))
    .returning();
  return res.json(updated[0]);
});

// POST /api/premium-message/pay: Client pays for a reply
router.post("/api/premium-message/pay", async (req, res) => {
  const { messageId, payerId } = req.body;
  if (!messageId || !payerId) return res.status(400).json({ error: "Missing required fields" });
  const msg = await db.query.premiumMessages.findFirst({
    where: eq(premiumMessages.id, Number(messageId))
  });
  if (!msg || !msg.price || !msg.receiverId) return res.status(404).json({ error: "Message not found or not payable" });

  // Get payer (client) Stripe customer ID
  const payer = await db.query.users.findFirst({ where: eq(users.id, payerId) });
  if (!payer?.stripeCustomerId) return res.status(400).json({ error: "Payer account not linked to Stripe" });

  // Stripe charge (payment intent)
  const payment = await stripe.paymentIntents.create({
    amount: Math.round(Number(msg.price) * 100),
    currency: "usd",
    customer: payer.stripeCustomerId,
    description: `SoulSeer Premium Message Payment (To Reader ID: ${msg.receiverId})`,
    metadata: {
      receiverId: msg.receiverId.toString(),
      payerId: payerId.toString(),
      messageId: msg.id.toString()
    }
  });

  await db.update(premiumMessages)
    .set({ isPaid: true })
    .where(eq(premiumMessages.id, Number(messageId)));

  // TODO: Notify reader (signal server/ws)
  return res.json({ paymentId: payment.id, isPaid: true });
});

// GET /api/premium-message?senderId=xxx&receiverId=yyy: List messages between users, ordered by createdAt
router.get("/api/premium-message", async (req, res) => {
  const { senderId, receiverId } = req.query;
  if (!senderId || !receiverId) return res.status(400).json({ error: "Missing senderId or receiverId param" });
  const msgs = await db.query.premiumMessages.findMany({
    where: and(
      eq(premiumMessages.senderId, Number(senderId)),
      eq(premiumMessages.receiverId, Number(receiverId))
    ),
    orderBy: asc(premiumMessages.createdAt)
  });
  return res.json(msgs);
});

export default router;