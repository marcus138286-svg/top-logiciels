import type { APIRoute } from 'astro';

// Stockage simple en mémoire (en prod, utiliser une DB comme Redis ou Vercel KV)
const clickStats = new Map<string, number>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const { tool, url } = await request.json();

    if (!tool || !url) {
      return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });
    }

    // Incrémenter le compteur
    const currentCount = clickStats.get(tool) || 0;
    clickStats.set(tool, currentCount + 1);

    // Log pour debug (visible dans les logs Vercel)
    console.log(`[AFFILIATE CLICK] ${tool}: ${currentCount + 1} clics total`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
};

// Endpoint GET pour voir les stats (optionnel, à sécuriser en prod)
export const GET: APIRoute = async () => {
  const stats = Object.fromEntries(clickStats);
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
