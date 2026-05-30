import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const dbName = process.env.MONGO_DB_NAME ?? 'homemanager';
  const db = client.db(dbName);
  const collections = await db.collections();
  console.log('Connected to MongoDB', dbName, 'collections:', collections.map(c => c.collectionName));
} catch (error) {
  console.error('Mongo connection failed:', error);
  process.exit(1);
} finally {
  await client.close();
}
