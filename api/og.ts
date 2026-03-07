import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

interface Entidad {
  entidad: string;
  situacion: number;
  monto: number;
}

interface Periodo {
  periodo: string;
  entidades: Entidad[];
}

interface BCRAResult {
  denominacion: string;
  periodos: Periodo[];
}

const SITUATION_COLORS: Record<number, string> = {
  1: '#14532d',
  2: '#78350f',
  3: '#7c2d12',
  4: '#7f1d1d',
  5: '#581c87',
  6: '#1e1b4b',
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}B`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}M`;
  return `$${n.toFixed(0)} mil`;
}


function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '\u2026';
}

function buildSvg(opts: {
  name: string;
  cuit: string;
  totalDebt: number;
  bgColor: string;
  isIrregular: boolean;
  periodo: string;
  entityCount: number;
}): string {
  const { name, cuit, totalDebt, bgColor, isIrregular, periodo, entityCount } = opts;
  const badgeColor = isIrregular ? '#ef4444' : '#22c55e';
  const badgeBg = isIrregular ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)';
  const badgeText = isIrregular ? 'Situacion irregular' : 'Situacion regular';
  const displayName = escapeXml(truncateName(name, 40));

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${bgColor}" />

  <!-- Header: site name + badge -->
  <text x="60" y="90" fill="white" opacity="0.7" font-family="sans-serif" font-size="28">deudas.ar</text>
  <rect x="200" y="64" width="${isIrregular ? 250 : 230}" height="36" rx="18" fill="${badgeBg}" stroke="${badgeColor}" stroke-width="2" />
  <text x="${isIrregular ? 325 : 315}" y="89" fill="${badgeColor}" font-family="sans-serif" font-size="22" text-anchor="middle">${badgeText}</text>

  <!-- Name -->
  <text x="60" y="175" fill="white" font-family="sans-serif" font-size="56" font-weight="bold">${displayName}</text>

  <!-- CUIT -->
  <text x="60" y="215" fill="white" opacity="0.6" font-family="sans-serif" font-size="26">CUIT ${escapeXml(cuit)}</text>

  <!-- Total debt label -->
  <text x="60" y="480" fill="white" opacity="0.6" font-family="sans-serif" font-size="24">Deuda total</text>
  <!-- Total debt value -->
  <text x="60" y="555" fill="white" font-family="sans-serif" font-size="64" font-weight="bold">${escapeXml(formatMoney(totalDebt))}</text>

  <!-- Right side info -->
  <text x="1140" y="520" fill="white" opacity="0.6" font-family="sans-serif" font-size="22" text-anchor="end">Periodo: ${escapeXml(periodo)}</text>
  <text x="1140" y="555" fill="white" opacity="0.4" font-family="sans-serif" font-size="20" text-anchor="end">${entityCount} entidad${entityCount !== 1 ? 'es' : ''}</text>
</svg>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cuit = req.query.cuit as string | undefined;

  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return res.status(400).send('Invalid CUIT');
  }

  try {
    const apiRes = await fetch(
      `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`
    );

    if (!apiRes.ok) {
      return res.status(502).send('BCRA API error');
    }

    const data = (await apiRes.json()) as { results: BCRAResult };
    const result = data.results;
    const name = result.denominacion;

    const latestPeriod = result.periodos[0];
    const entidades = latestPeriod?.entidades ?? [];

    const totalDebt = entidades.reduce((sum, e) => sum + e.monto, 0);

    // Dominant situation by total monto
    const situationTotals = new Map<number, number>();
    for (const e of entidades) {
      situationTotals.set(e.situacion, (situationTotals.get(e.situacion) ?? 0) + e.monto);
    }
    let dominantSituation = 1;
    let maxTotal = 0;
    for (const [sit, total] of situationTotals) {
      if (total > maxTotal) {
        maxTotal = total;
        dominantSituation = sit;
      }
    }

    const bgColor = SITUATION_COLORS[dominantSituation] ?? '#14532d';
    const isIrregular = entidades.some((e) => e.situacion >= 2);
    const periodo = latestPeriod?.periodo
      ? `${latestPeriod.periodo.slice(4)}/${latestPeriod.periodo.slice(0, 4)}`
      : '';

    const svg = buildSvg({
      name,
      cuit,
      totalDebt,
      bgColor,
      isIrregular,
      periodo,
      entityCount: entidades.length,
    });

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(png);
  } catch {
    return res.status(500).send('Error generating image');
  }
}
