import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getEntriesCollection, dbName } from "./lib/mongo";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handleEntriesApi(request: Request, url: URL): Promise<Response> {
  if (url.pathname === "/api/health" && request.method === "GET") {
    try {
      await getEntriesCollection();
      return jsonResponse({ ok: true, dbName, mongoConfigured: !!process.env.MONGO_URI });
    } catch (error) {
      return jsonResponse({ ok: false, error: errorMessage(error) }, 500);
    }
  }

  let collection;
  try {
    collection = await getEntriesCollection();
  } catch (error) {
    return jsonResponse({ error: `Database connection failed: ${errorMessage(error)}` }, 503);
  }

  if (url.pathname === "/api/entries" && request.method === "GET") {
    const entries = await collection.find().sort({ createdAt: -1 }).toArray();
    return jsonResponse(entries);
  }

  if (url.pathname === "/api/entries" && request.method === "POST") {
    const data = await request.json();
    const entry = {
      id: String(data.id ?? ""),
      name: String(data.name ?? "").trim(),
      amount: Number(data.amount ?? 0),
      date: String(data.date ?? ""),
      phone: data.phone ? String(data.phone).trim() : undefined,
      createdAt: Number(data.createdAt ?? Date.now()),
    };

    if (!entry.name || !entry.amount || !entry.date || !entry.id) {
      return jsonResponse({ error: "Missing required entry fields." }, 400);
    }

    await collection.updateOne(
      { id: entry.id },
      { $set: entry },
      { upsert: true },
    );

    return jsonResponse(entry, 201);
  }

  if (request.method === "DELETE") {
    const id = url.pathname.replace("/api/entries/", "");
    if (!id) {
      return jsonResponse({ error: "Entry id is required." }, 400);
    }
    const result = await collection.deleteOne({ id });
    return jsonResponse({ deleted: result.deletedCount === 1 });
  }

  return jsonResponse({ error: "Not found" }, 404);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health" || url.pathname.startsWith("/api/entries")) {
        return await handleEntriesApi(request, url);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
