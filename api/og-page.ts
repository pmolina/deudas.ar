import type { VercelRequest, VercelResponse } from '@vercel/node';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Entidad {
  situacion: number;
  monto: number;
}

interface BCRAResult {
  denominacion: string;
  periodos: { entidades: Entidad[] }[];
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}B`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}M`;
  return `$${n.toFixed(0)} mil`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cuit = req.query.cuit as string | undefined;

  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return res.status(400).send('Invalid CUIT');
  }

  let name = `CUIT ${cuit}`;
  let description = `Consulta la situacion crediticia del CUIT ${cuit} en el BCRA.`;

  try {
    const apiRes = await fetch(
      `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`
    );

    if (apiRes.ok) {
      const data = (await apiRes.json()) as { results: BCRAResult };
      const result = data.results;
      name = result.denominacion || name;

      const entidades = result.periodos[0]?.entidades ?? [];
      const totalDebt = entidades.reduce((sum: number, e: Entidad) => sum + e.monto, 0);
      const isIrregular = entidades.some((e: Entidad) => e.situacion >= 2);
      const status = isIrregular ? 'Irregular' : 'Regular';

      description = `${status} — Deuda total: ${formatMoney(totalDebt)} — ${entidades.length} entidad${entidades.length !== 1 ? 'es' : ''}`;
    }
  } catch {
    // Use defaults
  }

  const safeName = escapeHtml(name);
  const safeDescription = escapeHtml(description);
  const ogImageUrl = `https://deudas.ar/api/og?cuit=${cuit}`;
  const canonicalUrl = `https://deudas.ar/${cuit}/`;
  const now = new Date().toISOString();

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${safeName} — deudas.ar</title>
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${safeName} — deudas.ar" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="deudas.ar" />
  <meta property="article:author" content="deudas.ar" />
  <meta property="article:published_time" content="${now}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeName} — deudas.ar" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta name="author" content="deudas.ar" />
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <p>Redirigiendo...</p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return res.send(html);
}
