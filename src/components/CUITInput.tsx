import { useState, useEffect } from 'react';
import { Search, BrushCleaning } from 'lucide-react';
import { validateCuit } from '../utils/cuit';

interface Props {
  onSubmit: (cuits: string[]) => void;
  loading: boolean;
  initialValue?: string;
  externalValue?: string;
}

export function CUITInput({ onSubmit, loading, initialValue = '', externalValue }: Props) {
  const [value, setValue] = useState(() => initialValue.split(/[\n,]/)[0]?.trim() ?? '');

  useEffect(() => {
    if (externalValue !== undefined) setValue(externalValue);
  }, [externalValue]);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cuit = value.replace(/-/g, '').trim();

    if (!cuit) {
      setError('Ingresá un CUIT.');
      return;
    }
    if (!validateCuit(cuit)) {
      setError(`CUIT inválido: ${value.trim()}`);
      return;
    }

    setError('');
    onSubmit([cuit]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        CUIT / CUIL{' '}
        <span className="text-gray-400 dark:text-gray-500 font-normal">(con o sin guiones)</span>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          placeholder="20184139554"
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => { setValue(''); setError(''); }}
          disabled={loading || !value}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label="Limpiar"
        >
          <BrushCleaning size={18} />
        </button>
        <button
          type="submit"
          disabled={loading}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors shrink-0"
          aria-label="Consultar"
        >
          <Search size={18} />
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </form>
  );
}
