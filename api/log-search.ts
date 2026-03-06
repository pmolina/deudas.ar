import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { cuit, denominacion } = await req.json();
  if (!cuit || typeof cuit !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing cuit' }), { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    INSERT INTO searches (cuit, denominacion, searched_at)
    VALUES (${cuit}, ${denominacion ?? null}, NOW())
  `;

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
