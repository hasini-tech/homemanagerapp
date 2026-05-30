import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import server from "../dist/server/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const clientDist = path.join(rootDir, "dist", "client");
const publicDir = path.join(rootDir, "public");

const mimeTypes = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".cjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject"
};

function getContentType(filename) {
  return mimeTypes[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveStaticFile(urlPath) {
  const normalizedPath = urlPath.replace(/^\/+/, "");
  if (!normalizedPath) {
    return null;
  }

  const candidates = [
    path.join(clientDist, normalizedPath),
    path.join(publicDir, normalizedPath)
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate) && (await fs.stat(candidate)).isFile()) {
      return candidate;
    }
  }

  return null;
}

function toWebRequest(req, url) {
  const headers = req.headers || {};
  const requestInit = {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req)
  };
  return new Request(url, requestInit);
}

async function respondFromResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") {
      res.setHeader(name, value);
    } else {
      res.setHeader(name, value);
    }
  });

  const body = response.body ? await response.arrayBuffer() : null;
  if (body) {
    res.end(Buffer.from(body));
  } else {
    res.end();
  }
}

export default async function handler(req, res) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  const originalUrl =
    req.headers["x-vercel-original-url"] || req.headers["x-original-url"] || req.url;
  const url = new URL(originalUrl, `${protocol}://${host}`);
  const pathname = decodeURIComponent(url.pathname);

  const staticFilePath = await resolveStaticFile(pathname);
  if (staticFilePath) {
    const contents = await fs.readFile(staticFilePath);
    res.setHeader("content-type", getContentType(staticFilePath));
    res.end(contents);
    return;
  }

  const request = toWebRequest(req, url.toString());
  const response = await server.fetch(request, process.env, {});
  await respondFromResponse(res, response);
}
