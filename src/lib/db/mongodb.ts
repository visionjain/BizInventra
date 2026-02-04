// MongoDB Connection for Cloud Sync
import { MongoClient, Db, Collection, Document } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToMongoDB(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bizinventra';

  try {
    client = new MongoClient(uri);
    await client.connect();
    
    db = client.db();
    console.log('Connected to MongoDB');
    
    // Create indexes
    await createIndexes();
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to MongoDB');
  }
}

async function createIndexes(): Promise<void> {
  if (!db) return;

  try {
    // Users indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    // Items indexes
    await db.collection('items').createIndex({ userId: 1 });
    await db.collection('items').createIndex({ lastModifiedAt: 1 });

    // Customers indexes
    await db.collection('customers').createIndex({ userId: 1 });
    await db.collection('customers').createIndex({ lastModifiedAt: 1 });

    // Transactions indexes
    await db.collection('transactions').createIndex({ userId: 1 });
    await db.collection('transactions').createIndex({ customerId: 1 });
    await db.collection('transactions').createIndex({ transactionDate: -1 });
    await db.collection('transactions').createIndex({ lastModifiedAt: 1 });

    // Sync log indexes
    await db.collection('syncLog').createIndex({ userId: 1, synced: 1 });
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const database = await connectToMongoDB();
  return database.collection<T>(name);
}

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

// Utility functions for common operations
export async function findOne<T extends Document = Document>(
  collectionName: string,
  filter: any
): Promise<T | null> {
  const collection = await getCollection<T>(collectionName);
  return collection.findOne(filter) as Promise<T | null>;
}

export async function findMany<T extends Document = Document>(
  collectionName: string,
  filter: any = {},
  options: any = {}
): Promise<T[]> {
  const collection = await getCollection<T>(collectionName);
  return collection.find(filter, options).toArray() as Promise<T[]>;
}

export async function insertOne<T extends Document = Document>(
  collectionName: string,
  document: T
): Promise<string> {
  const collection = await getCollection<T>(collectionName);
  const result = await collection.insertOne(document as any);
  return result.insertedId.toString();
}

export async function insertMany<T extends Document = Document>(
  collectionName: string,
  documents: T[]
): Promise<void> {
  const collection = await getCollection<T>(collectionName);
  await collection.insertMany(documents as any[]);
}

export async function updateOne<T extends Document = Document>(
  collectionName: string,
  filter: any,
  update: any
): Promise<boolean> {
  const collection = await getCollection<T>(collectionName);
  // Check if update already contains MongoDB operators (like $set, $inc, $push, etc.)
  const hasOperator = Object.keys(update).some(key => key.startsWith('$'));
  // If it has operators, use directly; otherwise wrap in $set
  const updateDoc = hasOperator ? update : { $set: update };
  const result = await collection.updateOne(filter, updateDoc);
  return result.modifiedCount > 0;
}

export async function updateMany<T extends Document = Document>(
  collectionName: string,
  filter: any,
  update: any
): Promise<number> {
  const collection = await getCollection<T>(collectionName);
  const result = await collection.updateMany(filter, { $set: update });
  return result.modifiedCount;
}

export async function deleteOne(
  collectionName: string,
  filter: any
): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const result = await collection.deleteOne(filter);
  return result.deletedCount > 0;
}

export async function deleteMany(
  collectionName: string,
  filter: any
): Promise<number> {
  const collection = await getCollection(collectionName);
  const result = await collection.deleteMany(filter);
  return result.deletedCount;
}
