import { MongoClient } from "mongodb";
import { promises as dns, setServers } from "dns";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(here, "../../.env"),
  path.resolve(here, "../.env"),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath, override: true, quiet: true });
}

// Some Windows environments have broken default DNS settings for SRV lookup.
// Force public DNS resolvers before MongoDB Atlas SRV records are resolved.
setServers(["8.8.8.8", "1.1.1.1"]);

const configuredUri = process.env.MONGO_URI;
export const dbName = process.env.MONGO_DB_NAME ?? "homemanager";

if (!configuredUri) {
  throw new Error("MONGO_URI is required. Set it in your environment or in .env.local.");
}

async function resolveAtlasSrvUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const parsed = new URL(uri);
  const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  const txtRecords = await dns.resolveTxt(parsed.hostname).catch(() => []);
  const hosts = srvRecords
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((record) => `${record.name}:${record.port}`)
    .join(",");

  const params = new URLSearchParams(parsed.search);
  params.set("tls", "true");

  for (const record of txtRecords) {
    const txtParams = new URLSearchParams(record.join(""));
    txtParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return `mongodb://${parsed.username}:${parsed.password}@${hosts}${parsed.pathname}?${params.toString()}`;
}

let client: MongoClient | null = null;

let clientPromise: Promise<MongoClient> | null = null;

function isSrvDnsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return (
    message.includes("querySrv") ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEOUT" ||
    code === "EAI_AGAIN"
  );
}

async function connectWithUri(uri: string) {
  const mongoClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await mongoClient.connect();
    client = mongoClient;
    return mongoClient;
  } catch (error) {
    await mongoClient.close().catch(() => undefined);
    throw error;
  }
}

async function connectClient() {
  if (!clientPromise) {
    clientPromise = connectWithUri(configuredUri)
      .catch(async (error) => {
        if (!configuredUri.startsWith("mongodb+srv://") || !isSrvDnsError(error)) {
          throw error;
        }

        console.warn("MongoDB SRV lookup failed; retrying with resolved Atlas hosts.", error);
        return connectWithUri(await resolveAtlasSrvUri(configuredUri));
      })
      .catch((error) => {
        client = null;
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export async function closeMongoClient() {
  if (client) {
    await client.close().catch((error) => {
      clientPromise = null;
      throw error;
    });
    client = null;
    clientPromise = null;
  }
}

export async function getEntriesCollection() {
  const mongoClient = await connectClient();
  return mongoClient.db(dbName).collection("entries");
}
