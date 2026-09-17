import type { APIRoute } from 'astro';

const pages = [
  '',
  '/codes-promo',
  '/a-propos',
  '/mentions-legales',
  '/blog',
  '/blog/comment-choisir-crm',
  '/blog/email-marketing-debutant',
  '/blog/outils-ia-redaction',
  '/comparatif/email-marketing',
  '/comparatif/crm',
  '/comparatif/outils-ia',
  '/comparatif/compta-finance',
  '/avis',
  '/avis/getresponse',
  '/avis/brevo',
  '/avis/activecampaign',
  '/avis/hubspot',
  '/avis/pipedrive',
  '/avis/jasper',
  '/avis/copyai',
  '/avis/qonto',
  '/avis/pennylane',
  '/avis/shine',
  '/avis/indy',
  '/avis/quickbooks',
];

const siteUrl = 'https://saasdeals.fr';

export const GET: APIRoute = async () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${siteUrl}${page}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${page === '' ? '1.0' : page.includes('comparatif') ? '0.9' : '0.7'}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
