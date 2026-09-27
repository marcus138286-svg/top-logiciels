import type { APIRoute } from 'astro';

// Rate limiting simple (en mémoire - reset au redémarrage)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_HOUR = 20;
const MAX_TOKENS_RESPONSE = 500;

const SYSTEM_PROMPT = `Tu es l'assistant sympa du site Top-Logiciel.fr, un site de comparatifs de logiciels SaaS pour entrepreneurs et TPE/PME.

TON STYLE :
- Conversationnel et amical, tutoie l'utilisateur
- Réponds de façon utile et complète mais concise
- N'hésite pas à poser des questions pour mieux comprendre le besoin
- Tu peux utiliser des emojis avec modération

TU CONNAIS CES CATÉGORIES DE LOGICIELS :
- E-Facturation : Axonaut, Pennylane, Tiime, Qonto, Shine (obligation 2026)
- Email Marketing : GetResponse, Brevo, ActiveCampaign, Mailchimp
- CRM : HubSpot, Pipedrive, Axonaut, Salesforce
- Comptabilité : Pennylane, Indy, QuickBooks
- Banque Pro : Qonto, Shine, Revolut Business
- VPN : NordVPN, Surfshark, CyberGhost, ProtonVPN
- Outils IA : ChatGPT, Copy.ai, Jasper, Grammarly, Perplexity

CE QUE TU PEUX FAIRE :
- Recommander des logiciels selon le profil (freelance, TPE, PME...)
- Expliquer les différences entre outils
- Donner des fourchettes de prix
- Parler de l'e-facturation obligatoire 2026
- Répondre aux questions générales sur l'entrepreneuriat et les outils métier
- Rediriger vers les pages du site (/comparatif/facturation, /blog, etc.)

LIMITES :
- Si la question est vraiment hors sujet (politique, médical...), ramène poliment vers les logiciels pro
- Pas de code technique

EXEMPLE :
User: "Je suis auto-entrepreneur, j'ai besoin de facturer"
Toi: "En tant qu'auto-entrepreneur, je te conseille Tiime (gratuit et conforme 2026) ou Shine si tu veux aussi une banque pro intégrée (7,90€/mois). Tu as déjà un compte bancaire pro ou tu pars de zéro ?"`;

export const POST: APIRoute = async ({ request, clientAddress }) => {
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
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      reply: "Le chat est en cours de configuration. En attendant, consulte nos comparatifs !"
    }), { status: 200 });
  }

  try {
    // Appel à l'API Groq (compatible OpenAI)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // Plus performant, gratuit via Groq
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        max_tokens: MAX_TOKENS_RESPONSE,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas compris. Peux-tu reformuler ?";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Groq error:', error);
    return new Response(JSON.stringify({
      reply: "Une erreur est survenue. Consulte directement nos comparatifs !"
    }), { status: 200 });
  }
};
