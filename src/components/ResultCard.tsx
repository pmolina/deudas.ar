import { useState } from 'react';
import type { ResultState, ChequesState } from '../types/bcra';
import { DebtChart } from './DebtChart';
import { ChecksTable } from './ChecksTable';

function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

interface Props {
  cuit: string;
  state: ResultState;
  checksState: ChequesState;
}

function formatCuit(cuit: string): string {
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
}

type Tab = 'deudas' | 'cheques';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32 gap-2 text-gray-400 dark:text-gray-500">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-sm">Consultando BCRA…</span>
    </div>
  );
}

export function ResultCard({ cuit, state, checksState }: Props) {
  const [tab, setTab] = useState<Tab>('deudas');
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/${cuit}/`;
    const title = denominacion ?? cuit;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed the share sheet — do nothing
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const denominacion =
    state.status === 'success' ? state.data.denominacion :
    checksState.status === 'success' ? checksState.data.denominacion :
    null;

  const hasIrregularLastPeriod = state.status === 'success' && (() => {
    const lastPeriodo = state.data.periodos.reduce((a, b) =>
      a.periodo > b.periodo ? a : b
    );
    return lastPeriodo.entidades.some(e => e.situacion >= 2);
  })();

  const checksCount =
    checksState.status === 'success'
      ? checksState.data.causales.reduce(
          (sum, c) => sum + c.entidades.reduce((s, e) => s + e.detalle.length, 0),
          0
        )
      : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-visible">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2 rounded-t-xl">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatCuit(cuit)}</p>
          {denominacion && (
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 truncate">
              {denominacion}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasIrregularLastPeriod ? (
            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full whitespace-nowrap">
              Situación irregular
            </span>
          ) : state.status === 'success' ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full whitespace-nowrap">
              Situación normal
            </span>
          ) : null}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Consultá el historial de deudas de ${denominacion ?? cuit} en la Central de Deudores del BCRA: ${window.location.origin}/${cuit}/`)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Compartir por WhatsApp"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-green-500 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <WhatsAppIcon />
          </a>
          <button
            onClick={handleShare}
            title="Compartir enlace"
            className={`p-1.5 rounded-lg border transition-colors ${
              copied
                ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            {copied ? <CheckIcon /> : <ShareIcon />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 px-4">
        {([
          { key: 'deudas', label: 'Deudas históricas' },
          { key: 'cheques', label: 'Cheques rechazados', count: checksCount },
        ] as { key: Tab; label: string; count?: number | null }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 px-1 mr-5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-4">
        {tab === 'deudas' && (
          <>
            {state.status === 'loading' && <Spinner />}
            {state.status === 'error' && (
              <div className="flex items-center justify-center h-32 text-red-500 dark:text-red-400 text-sm">
                {state.message}
              </div>
            )}
            {state.status === 'empty' && (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
                Sin deuda registrada en el BCRA
              </div>
            )}
            {state.status === 'success' && (
              state.data.periodos.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
                  Sin períodos con deuda
                </div>
              ) : (
                <DebtChart periodos={state.data.periodos} />
              )
            )}
          </>
        )}

        {tab === 'cheques' && (
          <>
            {checksState.status === 'loading' && <Spinner />}
            {checksState.status === 'error' && (
              <div className="flex items-center justify-center h-32 text-red-500 dark:text-red-400 text-sm">
                {checksState.message}
              </div>
            )}
            {checksState.status === 'empty' && (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
                Sin cheques rechazados
              </div>
            )}
            {checksState.status === 'success' && (
              <ChecksTable data={checksState.data} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
