import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

let client = null;
let db = null;

/**
 * Initialize MongoDB connection
 */
export async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/millis_agents';
  const dbName = process.env.DB_NAME || 'millis_agents';

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    
    
    await db.collection('agents').createIndex({ agentId: 1 }, { unique: true });
    await db.collection('agents').createIndex({ phoneNumber: 1 }, { unique: true });
    await db.collection('agents').createIndex({ active: 1 });
    
    console.error('✅ Connected to MongoDB successfully');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}

/**
 * Close MongoDB connection
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.error('MongoDB connection closed');
  }
}

/**
 * Agent Collection Operations
 */
export const Agents = {
  /**
   * Create or update an agent
   */
  async upsert(agentData) {
    const db = getDB();
    const collection = db.collection('agents');
    
    const { agentId, ...data } = agentData;
    
    const result = await collection.updateOne(
      { agentId },
      { 
        $set: { 
          ...data, 
          updatedAt: new Date() 
        },
        $setOnInsert: { 
          createdAt: new Date() 
        }
      },
      { upsert: true }
    );
    
    return result;
  },

  /**
   * Get an agent by ID
   */
  async getByAgentId(agentId) {
    const db = getDB();
    const collection = db.collection('agents');
    return await collection.findOne({ agentId });
  },

  /**
   * Get an agent by phone number
   */
  async getByPhoneNumber(phoneNumber) {
    const db = getDB();
    const collection = db.collection('agents');
    return await collection.findOne({ phoneNumber });
  },

  /**
   * Get all active agents
   */
  async getAllActive() {
    const db = getDB();
    const collection = db.collection('agents');
    return await collection.find({ active: true }).toArray();
  },

  /**
   * Get all agents with pagination
   */
  async getAll(skip = 0, limit = 50) {
    const db = getDB();
    const collection = db.collection('agents');
    const total = await collection.countDocuments();
    const agents = await collection.find().skip(skip).limit(limit).toArray();
    return { agents, total, skip, limit };
  },

  /**
   * Delete an agent
   */
  async delete(agentId) {
    const db = getDB();
    const collection = db.collection('agents');
    return await collection.deleteOne({ agentId });
  },

  /**
   * Toggle agent active status
   */
  async toggleStatus(agentId, active) {
    const db = getDB();
    const collection = db.collection('agents');
    return await collection.updateOne(
      { agentId },
      { $set: { active, updatedAt: new Date() } }
    );
  },
};
