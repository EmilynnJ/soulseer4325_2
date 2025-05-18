import { pgTable, serial, integer, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { readings } from "./readings";
import { users } from "./users";

export const readingSessions = pgTable("reading_sessions", {
  sessionId: serial("session_id").primaryKey(),
  readingId: integer("reading_id").notNull().references(() => readings.id),
  readerId: integer("reader_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  elapsedSeconds: integer("elapsed_seconds").default(0),
  totalMinutes: integer("total_minutes"),
  amountCharged: integer("amount_charged"), // in cents
  paymentIntentId: text("payment_intent_id"),
  paymentStatus: text("payment_status", { enum: ["pending", "authorized", "paid", "failed", "refunded"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export default readingSessions;