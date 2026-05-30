import dotenv from "dotenv";
dotenv.config();
const { default: server } = await import('./dist/server/server.js');
const entry = {
  id: 'test-save-123',
  name: 'Test Save',
  amount: 10,
  date: '2026-06-01',
  phone: '+911234567890',
  createdAt: Date.now(),
};
const req = new Request('http://localhost/api/entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(entry),
});
const res = await server.fetch(req, process.env, {});
console.log('STATUS', res.status);
console.log('BODY', await res.text());