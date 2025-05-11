import { admin } from "../firebase-admin";
import session from "express-session";
import createMemoryStore from "memorystore";
import { IStorage } from "../storage";
import {
  type User,
  type InsertUser,
  type UserUpdate,
  type Reading,
  type InsertReading,
  type Message,
  type InsertMessage,
  type Livestream,
  type InsertLivestream
} from "@shared/schema";

const MemoryStore = createMemoryStore(session);

export class FirebaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
  }

  private toUser(val: any): User {
    return {
      ...val,
      id: val.id,
      createdAt: new Date(val.createdAt),
      lastActive: new Date(val.lastActive)
    };
  }

  private toReading(val: any, key: string): Reading {
    return {
      ...val,
      id: Number(key),
      createdAt: new Date(val.createdAt),
      scheduledFor: val.scheduledFor != null ? new Date(val.scheduledFor) : null,
      notes: val.notes ?? null,
      startedAt: val.startedAt != null ? new Date(val.startedAt) : null,
      completedAt: val.completedAt != null ? new Date(val.completedAt) : null
    };
  }

  private toMessage(val: any): Message {
    return {
      ...val,
      id: val.id,
      createdAt: new Date(val.createdAt),
      readAt: val.readAt != null ? new Date(val.readAt) : null
    };
  }

  private toLivestream(val: any, key: string): Livestream {
    return {
      ...val,
      id: Number(key),
      createdAt: new Date(val.createdAt),
      scheduledFor: val.scheduledFor != null ? new Date(val.scheduledFor) : null,
      startedAt: val.startedAt != null ? new Date(val.startedAt) : null,
      endedAt: val.endedAt != null ? new Date(val.endedAt) : null
    };
  }

  // User methods
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = Date.now();
    const now = new Date();
    const user: any = {
      ...insertUser,
      id,
      createdAt: now.getTime(),
      lastActive: now.getTime(),
      isOnline: false,
      reviewCount: 0,
      profileImage: (insertUser as any).profileImage ?? null,
      bio: (insertUser as any).bio ?? null,
      specialties: (insertUser as any).specialties ?? null,
      pricing: (insertUser as any).pricing ?? null,
      rating: (insertUser as any).rating ?? null,
      verified: (insertUser as any).verified ?? false,
      role: (insertUser as any).role ?? "client"
    };
    await admin.database().ref(`users/${id}`).set(user);
    return this.toUser(user);
  }

  async getUser(id: number): Promise<User | undefined> {
    const snap = await admin.database().ref(`users/${id}`).once("value");
    const val = snap.val();
    if (!val) return undefined;
    return this.toUser(val);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snap = await admin.database().ref("users").once("value");
    const vals = snap.val() || {};
    const found = Object.values(vals).find(
      (u: any) => u.username.toLowerCase() === username.toLowerCase()
    );
    return found ? this.toUser(found) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const snap = await admin.database().ref("users").once("value");
    const vals = snap.val() || {};
    const found = Object.values(vals).find(
      (u: any) => u.email.toLowerCase() === email.toLowerCase()
    );
    return found ? this.toUser(found) : undefined;
  }

  async updateUser(id: number, userData: UserUpdate): Promise<User | undefined> {
    const ref = admin.database().ref(`users/${id}`);
    const snap = await ref.once("value");
    if (!snap.exists()) return undefined;
    const updates: any = { ...userData };
    if (userData.lastActive) updates.lastActive = userData.lastActive.getTime();
    await ref.update(updates);
    const updated = await ref.once("value");
    return this.toUser(updated.val());
  }

  async getReaders(): Promise<User[]> {
    const snap = await admin.database().ref("users").once("value");
    const vals = snap.val() || {};
    return Object.values(vals)
      .filter((u: any) => u.role === "reader")
      .map((u: any) => this.toUser(u));
  }

  async getOnlineReaders(): Promise<User[]> {
    const snap = await admin.database().ref("users").once("value");
    const vals = snap.val() || {};
    return Object.values(vals)
      .filter((u: any) => u.role === "reader" && u.isOnline)
      .map((u: any) => this.toUser(u));
  }

  async getAllUsers(): Promise<User[]> {
    const snap = await admin.database().ref("users").once("value");
    const vals = snap.val() || {};
    return Object.values(vals).map((u: any) => this.toUser(u));
  }

  // Reading methods
  async createReading(insertReading: InsertReading): Promise<Reading> {
    const id = Date.now();
    const now = new Date();
    const reading: any = {
      ...insertReading,
      id,
      createdAt: now.getTime(),
      completedAt: null,
      rating: null,
      review: null,
      scheduledFor: insertReading.scheduledFor
        ? insertReading.scheduledFor.getTime()
        : null,
      notes: insertReading.notes ?? null,
      startedAt: null,
      totalPrice: null,
      duration: insertReading.duration ?? null,
      paymentStatus: "pending",
      paymentId: null,
      paymentLinkUrl: null
    };
    await admin.database().ref(`readings/${id}`).set(reading);
    return this.toReading(reading, String(id));
  }

  async getReading(id: number): Promise<Reading | undefined> {
    const snap = await admin.database().ref(`readings/${id}`).once("value");
    const val = snap.val();
    if (!val) return undefined;
    return this.toReading(val, String(id));
  }

  async getReadings(): Promise<Reading[]> {
    const snap = await admin.database().ref("readings").once("value");
    const vals = snap.val() || {};
    return Object.entries(vals).map(([k, v]: [string, any]) =>
      this.toReading(v, k)
    );
  }

  async getReadingsByClient(clientId: number): Promise<Reading[]> {
    const all = await this.getReadings();
    return all.filter(r => r.clientId === clientId);
  }

  async getReadingsByReader(readerId: number): Promise<Reading[]> {
    const all = await this.getReadings();
    return all.filter(r => r.readerId === readerId);
  }

  async updateReading(
    id: number,
    readingData: Partial<InsertReading> & {
      startedAt?: Date | null;
      completedAt?: Date | null;
      totalPrice?: number | null;
      paymentStatus?: string | null;
      paymentId?: string | null;
      paymentLinkUrl?: string | null;
      rating?: number | null;
      review?: string | null;
    }
  ): Promise<Reading | undefined> {
    const ref = admin.database().ref(`readings/${id}`);
    const snap = await ref.once("value");
    if (!snap.exists()) return undefined;
    const updates: any = {};
    for (const [key, value] of Object.entries(readingData)) {
      if (value instanceof Date) {
        updates[key] = value.getTime();
      } else {
        updates[key] = value;
      }
    }
    await ref.update(updates);
    const updated = await ref.once("value");
    return this.toReading(updated.val(), String(id));
  }

  // Message methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = Date.now();
    const now = new Date();
    const message: any = {
      ...insertMessage,
      id,
      createdAt: now.getTime(),
      readAt: null
    };
    await admin.database().ref(`messages/${id}`).set(message);
    return this.toMessage(message);
  }

  async getMessagesByUsers(
    userId1: number,
    userId2: number
  ): Promise<Message[]> {
    const snap = await admin.database().ref("messages").once("value");
    const vals = snap.val() || {};
    return Object.values(vals)
      .filter(
        (m: any) =>
          (m.senderId === userId1 && m.receiverId === userId2) ||
          (m.senderId === userId2 && m.receiverId === userId1)
      )
      .map((m: any) => this.toMessage(m));
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const snap = await admin.database().ref("messages").once("value");
    const vals = snap.val() || {};
    return Object.values(vals).filter(
      (m: any) => m.receiverId === userId && m.readAt == null
    ).length;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const ref = admin.database().ref(`messages/${id}`);
    const snap = await ref.once("value");
    const val = snap.val();
    if (!val) return undefined;
    const now = Date.now();
    await ref.update({ readAt: now });
    return this.toMessage({ ...val, readAt: now });
  }

  // Livestream methods
  async createLivestream(insertLivestream: InsertLivestream): Promise<Livestream> {
    const id = Date.now();
    const now = new Date();
    const ls: any = {
      ...insertLivestream,
      id,
      createdAt: now.getTime(),
      startedAt: null,
      endedAt: null,
      viewerCount: 0,
      scheduledFor: insertLivestream.scheduledFor
        ? insertLivestream.scheduledFor.getTime()
        : null
    };
    await admin.database().ref(`livestreams/${id}`).set(ls);
    return this.toLivestream(ls, String(id));
  }

  async getLivestream(id: number): Promise<Livestream | undefined> {
    const snap = await admin.database().ref(`livestreams/${id}`).once("value");
    const val = snap.val();
    if (!val) return undefined;
    return this.toLivestream(val, String(id));
  }

  async getLivestreams(): Promise<Livestream[]> {
    const snap = await admin.database().ref("livestreams").once("value");
    const vals = snap.val() || {};
    return Object.entries(vals).map(([k, v]: [string, any]) =>
      this.toLivestream(v, k)
    );
  }

  async getLivestreamsByUser(userId: number): Promise<Livestream[]> {
    const all = await this.getLivestreams();
    return all.filter(ls => ls.userId === userId);
  }

  async updateLivestream(
    id: number,
    livestreamData: Partial<InsertLivestream>
  ): Promise<Livestream | undefined> {
    const ref = admin.database().ref(`livestreams/${id}`);
    const snap = await ref.once("value");
    if (!snap.exists()) return undefined;
    const updates: any = {};
    for (const [key, value] of Object.entries(livestreamData)) {
      if (value instanceof Date) {
        updates[key] = value.getTime();
      } else {
        updates[key] = value;
      }
    }
    await ref.update(updates);
    const updated = await ref.once("value");
    return this.toLivestream(updated.val(), String(id));
  }

  // Other IStorage methods not implemented
  createProduct(): any { throw new Error("Not implemented"); }
  getProduct(): any { throw new Error("Not implemented"); }
  getProducts(): any { throw new Error("Not implemented"); }
  getFeaturedProducts(): any { throw new Error("Not implemented"); }
  updateProduct(): any { throw new Error("Not implemented"); }
  createOrder(): any { throw new Error("Not implemented"); }
  getOrder(): any { throw new Error("Not implemented"); }
  getOrdersByUser(): any { throw new Error("Not implemented"); }
  updateOrder(): any { throw new Error("Not implemented"); }
  createOrderItem(): any { throw new Error("Not implemented"); }
  getOrderItems(): any { throw new Error("Not implemented"); }
  createForumPost(): any { throw new Error("Not implemented"); }
  getForumPost(): any { throw new Error("Not implemented"); }
  getForumPosts(): any { throw new Error("Not implemented"); }
  updateForumPost(): any { throw new Error("Not implemented"); }
  createForumComment(): any { throw new Error("Not implemented"); }
  getForumCommentsByPost(): any { throw new Error("Not implemented"); }
  createGift(): any { throw new Error("Not implemented"); }
  getGiftsByLivestream(): any { throw new Error("Not implemented"); }
  getGiftsBySender(): any { throw new Error("Not implemented"); }
  getGiftsByRecipient(): any { throw new Error("Not implemented"); }
  getUnprocessedGifts(): any { throw new Error("Not implemented"); }
  markGiftAsProcessed(): any { throw new Error("Not implemented"); }
}
