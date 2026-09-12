import type { APIRoute } from 'astro';
import OpenAI from 'openai';

// Rate limiting simple (en mémoire - reset au redémarrage)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_HOUR = 15;
const MAX_TOKENS_RESPONSE = 300;

// Budget journalier (en dollars)
const DAILY_BUDGET = 1;
let dailySpent = 0;
let dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `Tu es l'assistant du site de comparatifs de logiciels professionnels.

TON RÔLE :
- Aider les visiteurs à choisir le bon logiciel selon leurs besoins
- Recommander des outils d'email, CRM, IA ou comptabilité
- Expliquer simplement ce que fait chaque logiciel

TU CONNAIS CES LOGICIELS :
- Email : GetResponse, Brevo, ActiveCampaign
- CRM : HubSpot, Pipedrive
- IA : Jasper AI, Copy.ai
- Compta/Finance : Pennylane, QuickBooks, Qonto, Shine, Indy

RÈGLES STRICTES :
- Tu parles UNIQUEMENT de logiciels professionnels
- Tu REFUSES tout autre sujet (politique, code, devoirs, santé, crypto, bourse, etc.)
- Si on te demande autre chose, réponds : "Je suis spécialisé dans les logiciels pro. Quel est ton besoin métier ?"
- Réponses COURTES (2-3 phrases max)
- Tu peux suggérer de voir la page comparatif pour plus de détails
- JAMAIS de code, JAMAIS de contenu long

EXEMPLE :
User: "Je veux envoyer des newsletters"
Toi: "Pour les newsletters, je te recommande GetResponse (complet, 13€/mois) ou Brevo (gratuit pour débuter). Tu veux que je t'explique les différences ?"`;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Check daily budget
  if (Date.now() > dailyResetTime) {
    dailySpent = 0;
    dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;
  }

  if (dailySpent >= DAILY_BUDGET) {
    return new Response(JSON.stringify({
      error: "Service temporairement indisponible. Réessaie demain."
    }), { status: 429 });
  }

  // Rate limiting par IP
  const ip = clientAddress || 'unknown';
  const now = Date.now();
  const userLimit = rateLimits.get(ip);

  if (userLimit) {
    if (now > userLimit.resetTime) {
      rateLimits.set(ip, { count: 1, resetTime: now + 3600000 });
    } else if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
      return new Response(JSON.stringify({
        error: "Tu as atteint la limite. Réessaie dans 1 heure."
      }), { status: 429 });
    } else {
      userLimit.count++;
    }
  } else {
    rateLimits.set(ip, { count: 1, resetTime: now + 3600000 });
  }

  // Parse request
  let message: string;
  let honeypot: string;
  let timestamp: number;

  try {
    const body = await request.json();
    message = body.message?.slice(0, 500) || '';
    honeypot = body.honeypot || '';
    timestamp = body.timestamp || 0;
  } catch {
    return new Response(JSON.stringify({ error: "Message invalide" }), { status: 400 });
  }

  // Anti-bot: honeypot doit être vide
  if (honeypot) {
    return new Response(JSON.stringify({ reply: "Une erreur est survenue." }), { status: 200 });
  }

  // Anti-bot: délai minimum 1 seconde entre ouverture et envoi
  if (timestamp && (now - timestamp) < 1000) {
    return new Response(JSON.stringify({ reply: "Trop rapide ! Réessaie." }), { status: 200 });
  }

  if (!message.trim()) {
    return new Response(JSON.stringify({ error: "Message vide" }), { status: 400 });
  }

  // Check API key
  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      reply: "Le chat est en cours de configuration. En attendant, consulte nos comparatifs !"
    }), { status: 200 });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      max_tokens: MAX_TOKENS_RESPONSE,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || "Désolé, je n'ai pas compris. Peux-tu reformuler ?";

    // Track spending (approximatif)
    const tokensUsed = completion.usage?.total_tokens || 0;
    dailySpent += (tokensUsed / 1000000) * 0.15; // Prix GPT-4o-mini approximatif

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OpenAI error:', error);
    return new Response(JSON.stringify({
      reply: "Une erreur est survenue. Consulte directement nos comparatifs !"
    }), { status: 200 });
  }
};
