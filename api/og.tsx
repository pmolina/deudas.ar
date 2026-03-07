import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

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
  2: '#7c2d12',
  3: '#7c2d12',
  4: '#7f1d1d',
  5: '#7f1d1d',
  6: '#7f1d1d',
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}B`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}M`;
  return `$${n.toFixed(0)} mil`;
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '\u2026';
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const cuit = url.searchParams.get('cuit');

  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return new Response('Invalid CUIT', { status: 400 });
  }

  try {
    const apiRes = await fetch(
      `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`
    );

    if (!apiRes.ok) {
      return new Response('BCRA API error', { status: 502 });
    }

    const data = (await apiRes.json()) as { results: BCRAResult };
    const result = data.results;
    const name = truncateName(result.denominacion, 40);

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

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px',
            backgroundColor: bgColor,
            color: 'white',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: 28, opacity: 0.7 }}>deudas.ar</span>
              <div
                style={{
                  display: 'flex',
                  padding: '4px 16px',
                  borderRadius: '9999px',
                  backgroundColor: isIrregular
                    ? 'rgba(239,68,68,0.25)'
                    : 'rgba(34,197,94,0.25)',
                  border: `2px solid ${isIrregular ? '#ef4444' : '#22c55e'}`,
                  fontSize: 22,
                  color: isIrregular ? '#fca5a5' : '#86efac',
                }}
              >
                {isIrregular ? 'Situacion irregular' : 'Situacion regular'}
              </div>
            </div>
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.1,
                marginBottom: '8px',
              }}
            >
              {name}
            </span>
            <span style={{ fontSize: 26, opacity: 0.6 }}>
              CUIT {cuit}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 24, opacity: 0.6, marginBottom: '4px' }}>
                Deuda total
              </span>
              <span style={{ fontSize: 64, fontWeight: 700 }}>
                {formatMoney(totalDebt)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 22, opacity: 0.6 }}>
                Periodo: {periodo}
              </span>
              <span style={{ fontSize: 20, opacity: 0.4, marginTop: '4px' }}>
                {entidades.length} entidad{entidades.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch {
    return new Response('Error generating image', { status: 500 });
  }
}
