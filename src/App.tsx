import { useState, useEffect } from 'react';
import type { ResultState, ChequesState } from './types/bcra';
import { fetchDebtHistory, fetchRejectedChecks, NotFoundError } from './api/bcra';
import { CUITInput } from './components/CUITInput';
import { ResultCard } from './components/ResultCard';

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="7.05" y2="7.05"/>
      <line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="7.05" y2="16.95"/>
      <line x1="16.95" y1="7.05" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

const STATUS_CUIT = '30546676427';

interface HistoryItem {
  cuit: string;
  denominacion: string | null;
  searchedAt: number;
}

const HISTORY_KEY = 'cuit_history';
const MAX_HISTORY = 10;

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function formatCuit(cuit: string): string {
  return cuit.replace(/-/g, '');
}

type ApiStatus = 'checking' | 'ok' | 'error';

function ApiStatusPill({ status }: { status: ApiStatus }) {
  const label = status === 'checking' ? 'Verificando...' : status === 'ok' ? 'API operativa' : 'API con errores';
  const dot =
    status === 'checking'
      ? 'bg-yellow-400 animate-pulse'
      : status === 'ok'
      ? 'bg-green-400'
      : 'bg-red-500';
  const pill =
    status === 'checking'
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800'
      : status === 'ok'
      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return true;
  });

  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    async function checkApi() {
      try {
        const res = await fetch(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${STATUS_CUIT}`);
        setApiStatus(res.ok || res.status === 404 ? 'ok' : 'error');
      } catch {
        setApiStatus('error');
      }
    }
    checkApi();
    const interval = setInterval(checkApi, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [results, setResults] = useState<Map<string, ResultState>>(new Map());
  const [checksResults, setChecksResults] = useState<Map<string, ChequesState>>(new Map());
  const [activeCuits, setActiveCuits] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);

  function upsertHistory(cuit: string, denominacion: string | null) {
    setHistory(prev => {
      const existing = prev.find(h => h.cuit === cuit);
      const item: HistoryItem = {
        cuit,
        denominacion: denominacion ?? existing?.denominacion ?? null,
        searchedAt: Date.now(),
      };
      const next = [item, ...prev.filter(h => h.cuit !== cuit)].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeFromHistory(cuit: string) {
    setHistory(prev => {
      const next = prev.filter(h => h.cuit !== cuit);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  const [initialInputValue] = useState(() => {
    // Redirect ?cuit=... to /{cuit}/ path
    const params = new URLSearchParams(window.location.search);
    const queryCuit = params.get('cuit');
    if (queryCuit) {
      const cuits = queryCuit.split(',').map(c => c.replace(/-/g, '').trim()).filter(Boolean);
      if (cuits.length > 0) {
        const path = '/' + cuits.join(',') + '/';
        window.history.replaceState(null, '', path);
        return cuits.join('\n');
      }
    }
    // Read CUIT from path: /{cuit}/
    const pathMatch = window.location.pathname.match(/^\/([0-9,\-]+)\/?$/);
    if (pathMatch) {
      const cuits = pathMatch[1].split(',').map(c => c.replace(/-/g, '').trim()).filter(Boolean);
      if (cuits.length > 0) return cuits.join('\n');
    }
    return '';
  });

  const loading = [...results.values()].some(r => r.status === 'loading')
    || [...checksResults.values()].some(r => r.status === 'loading');

  useEffect(() => {
    // Read CUIT from path: /{cuit}/
    const pathMatch = window.location.pathname.match(/^\/([0-9,\-]+)\/?$/);
    if (pathMatch) {
      const cuits = pathMatch[1].split(',').map(c => c.replace(/-/g, '').trim()).filter(Boolean);
      if (cuits.length > 0) handleSubmit(cuits);
    }

    // Handle browser back/forward
    function onPopState() {
      const match = window.location.pathname.match(/^\/([0-9,\-]+)\/?$/);
      if (match) {
        const cuits = match[1].split(',').map(c => c.replace(/-/g, '').trim()).filter(Boolean);
        if (cuits.length > 0) {
          setInputValue(cuits.map(c => formatCuit(c)).join('\n'));
          handleSubmit(cuits);
          return;
        }
      }
      // Back to home
      setActiveCuits([]);
      setResults(new Map());
      setChecksResults(new Map());
      setInputValue('');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(cuits: string[]) {
    setActiveCuits(cuits);

    // Update URL to /{cuit}/ path
    const newPath = '/' + cuits.join(',') + '/';
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }

    const loadingDebt = new Map<string, ResultState>(cuits.map(c => [c, { status: 'loading' }]));
    const loadingChecks = new Map<string, ChequesState>(cuits.map(c => [c, { status: 'loading' }]));
    setResults(loadingDebt);
    setChecksResults(loadingChecks);

    // Fetch debt history and rejected checks in parallel for all CUITs
    const [debtSettled, checksSettled] = await Promise.all([
      Promise.allSettled(cuits.map(c => fetchDebtHistory(c))),
      Promise.allSettled(cuits.map(c => fetchRejectedChecks(c))),
    ]);

    const notFoundCuits = new Set(
      cuits.filter((_, i) =>
        debtSettled[i]?.status === 'rejected' && debtSettled[i].reason instanceof NotFoundError &&
        checksSettled[i]?.status === 'rejected' && checksSettled[i].reason instanceof NotFoundError
      )
    );

    cuits.forEach((cuit, i) => {
      const debt = debtSettled[i];
      const checks = checksSettled[i];
      const bothFailed = debt?.status === 'rejected' && checks?.status === 'rejected';
      if (bothFailed) return;
      const denominacion =
        (debt?.status === 'fulfilled' && debt.value.results?.denominacion) ||
        (checks?.status === 'fulfilled' && checks.value.results?.denominacion) ||
        null;
      upsertHistory(cuit, denominacion);
    });

    setResults(() => {
      const next = new Map<string, ResultState>();
      debtSettled.forEach((result, i) => {
        const cuit = cuits[i]!;
        if (notFoundCuits.has(cuit)) {
          next.set(cuit, { status: 'error', message: 'CUIT no encontrado en el sistema del BCRA' });
        } else if (result.status === 'fulfilled') {
          const data = result.value.results;
          if (!data || data.periodos.length === 0) {
            next.set(cuit, { status: 'empty' });
          } else {
            next.set(cuit, { status: 'success', data });
          }
        } else {
          const is404 = result.reason instanceof NotFoundError;
          next.set(cuit, is404 ? { status: 'empty' } : { status: 'error', message: result.reason instanceof Error ? result.reason.message : 'Error desconocido' });
        }
      });
      return next;
    });

    setChecksResults(() => {
      const next = new Map<string, ChequesState>();
      checksSettled.forEach((result, i) => {
        const cuit = cuits[i]!;
        if (notFoundCuits.has(cuit)) {
          next.set(cuit, { status: 'error', message: 'CUIT no encontrado en el sistema del BCRA' });
        } else if (result.status === 'fulfilled') {
          const data = result.value.results;
          if (!data || data.causales.length === 0) {
            next.set(cuit, { status: 'empty' });
          } else {
            next.set(cuit, { status: 'success', data });
          }
        } else {
          const is404 = result.reason instanceof NotFoundError;
          next.set(cuit, is404 ? { status: 'empty' } : { status: 'error', message: result.reason instanceof Error ? result.reason.message : 'Error desconocido' });
        }
      });
      return next;
    });
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/" className="text-2xl font-bold text-gray-900 dark:text-white hover:underline">
                Central de Deudores del BCRA
              </a>
              <ApiStatusPill status={apiStatus} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Consultá el historial de deudas por CUIL/CUIT.
            </p>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="shrink-0 mt-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-8">
          <CUITInput onSubmit={handleSubmit} loading={loading} initialValue={initialInputValue} externalValue={inputValue} />
          {history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tus busquedas recientes</p>
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem(HISTORY_KEY);
                  }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Borrar todo
                </button>
              </div>
              <div className="space-y-0.5">
                {history.map(item => (
                  <div key={item.cuit} className="flex items-center gap-1 group">
                    <button
                      onClick={() => { setInputValue(formatCuit(item.cuit)); handleSubmit([item.cuit]); }}
                      disabled={loading}
                      className="flex-1 flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left min-w-0 disabled:opacity-50"
                    >
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
                        {formatCuit(item.cuit)}
                      </span>
                      {item.denominacion && (
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {item.denominacion}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => removeFromHistory(item.cuit)}
                      className="shrink-0 p-1.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      aria-label="Eliminar del historial"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeCuits.length > 0 && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Resultados
            </h2>
            {activeCuits.map(cuit => (
              <ResultCard
                key={cuit}
                cuit={cuit}
                state={results.get(cuit) ?? { status: 'loading' }}
                checksState={checksResults.get(cuit) ?? { status: 'loading' }}
              />
            ))}
          </div>
        )}
        <footer className="mt-12 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-600">
          <span>
            Hecho por <a
              href="https://x.com/intent/user?screen_name=patomolina"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 dark:text-gray-500 underline underline-offset-2 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              Pato Molina
            </a>
          </span>
          <span>|</span>
          <a
            href="https://github.com/pmolina/deudas.ar/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-gray-500 underline underline-offset-2 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            MIT License
          </a>
          <span>|</span>
          <a
            href="https://github.com/pmolina/deudas.ar"
            target="_blank"
            rel="noopener noreferrer"
            title="Ver código fuente"
            className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </footer>
      </div>
    </div>
  );
}
