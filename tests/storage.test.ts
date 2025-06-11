import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseStorage } from '../server/storage';

// Mocks
var selectMock: any;
var insertMock: any;

// Mock the schema module to avoid loading the actual database schema
vi.mock('@shared/schema', () => ({
  gifts: {
    createdAt: 'created_at',
    senderId: 'sender_id',
    recipientId: 'recipient_id',
    id: 'id'
  }
}));

// Mock the db module used in DatabaseStorage

vi.mock('../server/db', () => {
  selectMock = vi.fn();
  insertMock = vi.fn();
  return {
    db: {
      select: selectMock,
      insert: insertMock,
    }
  };
});

const storage = new DatabaseStorage();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DatabaseStorage gifts', () => {
  it('getGiftsBySender returns gifts from the database', async () => {
    const expected = [{ id: 1 }, { id: 2 }];
    selectMock.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(expected)
        })
      })
    });

    const result = await storage.getGiftsBySender('sender-id');
    expect(result).toEqual(expected);
    expect(selectMock).toHaveBeenCalled();
  });

  it('createGift calculates split and inserts into database', async () => {
    const giftInput = {
      senderId: 's1',
      recipientId: 'r1',
      amount: 1000,
      giftType: 'heart',
      message: 'hi',
      livestreamId: 3,
    };

    let valuesArg: any;
    insertMock.mockReturnValue({
      values: (arg: any) => {
        valuesArg = arg;
        return {
          returning: () => Promise.resolve([{ id: 10, ...arg }])
        };
      }
    });

    const result = await storage.createGift(giftInput);
    expect(insertMock).toHaveBeenCalled();
    expect(valuesArg.readerAmount).toBe(700);
    expect(valuesArg.platformAmount).toBe(300);
    expect(valuesArg.processed).toBe(false);
    expect(result.id).toBe(10);
    expect(result.readerAmount).toBe(700);
    expect(result.platformAmount).toBe(300);
  });
});

