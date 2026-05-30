import dotenv from "dotenv";
dotenv.config();
const { default: server } = await import('./dist/server/server.js');
const req = new Request('http://localhost/api/entries', { method: 'GET' });
const res = await server.fetch(req, process.env, {});
console.log('STATUS', res.status);
console.log('BODY', await res.text());