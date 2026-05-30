import { MongoClient } from "mongodb";
import { setServers } from "dns";
import dotenv from "dotenv";

// Load env vars BEFORE accessing them
dotenv.config();
dotenv.config({ path: ".env", override: true });

const uri = process.env.MONGO_URI;
export const dbName = process.env.MONGO_DB_NAME ?? "homemanager";

if (!uri) {
  throw new Error("MONGO_URI is required. Set it in your environment or in .env.local.");
}

// Some Windows environments have broken default DNS settings for SRV lookup.
// Force a public DNS resolver so Atlas SRV records resolve correctly.
setServers(["8.8.8.8", "1.1.1.1"]);

const client = new MongoClient(uri);

let clientPromise: Promise<MongoClient> | null = null;

function connectClient() {
  if (!clientPromise) {
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function getEntriesCollection() {
  const mongoClient = await connectClient();
  return mongoClient.db(dbName).collection("entries");
}
