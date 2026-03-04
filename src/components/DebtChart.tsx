import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Periodo } from '../types/bcra';
import { formatPeriod } from '../utils/format';
import { getEntityColor } from '../utils/colors';

interface Props {
  periodos: Periodo[];
}

function formatARS(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// Situation badge colors
function situacionClass(sit: number): string {
  if (sit >= 4) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  if (sit >= 2) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
  return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
}

const SITUACIONES: { sit: number; label: string }[] = [
  { sit: 1, label: 'Normal' },
  { sit: 2, label: 'Con seguimiento especial' },
  { sit: 3, label: 'Con problemas' },
  { sit: 4, label: 'Alto riesgo de insolvencia' },
  { sit: 5, label: 'Irrecuperable' },
];

function situacionLabel(sit: number): string {
  return `Situación ${sit}: ${SITUACIONES.find(s => s.sit === sit)?.label ?? 'Desconocida'}`;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  fill: string;
  payload: Record<string, unknown>;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const situations = payload[0]?.payload._situations as Map<string, number> | undefined;

  // Show only entries with actual debt in this period, sorted largest first
  const items = payload
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = items.reduce((sum, item) => sum + item.value, 0);

  // Group total debt by situation number
  const sitTotals = new Map<number, number>();
  for (const item of items) {
    const sit = situations?.get(item.name) ?? 1;
    sitTotals.set(sit, (sitTotals.get(sit) ?? 0) + item.value);
  }
  const sitEntries = Array.from(sitTotals.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs max-w-80">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      <div className="space-y-1.5">
        {items.map(item => {
          const situation = situations?.get(item.name) ?? 1;
          const irregular = situation >= 2;
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(2) : '0.00';
          return (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: item.fill }}
              />
              <span className="flex-1 truncate text-gray-700 dark:text-gray-300 min-w-0">
                {item.name}
              </span>
              <span className="shrink-0 text-right">
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatARS(item.value)}</span>
                <span className="text-gray-400 dark:text-gray-500 ml-1">({pct}%)</span>
              </span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${situacionClass(situation)}`}>
                Sit. {situation}
              </span>
              {irregular && (
                <svg
                  className="shrink-0 text-red-500"
                  width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Total row */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <span className="font-semibold text-gray-700 dark:text-gray-200">Total</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatARS(total)}</span>
      </div>

      {/* Per-situation breakdown */}
      {sitEntries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
          <p className="text-gray-400 dark:text-gray-500 mb-1.5">Por situación</p>
          {sitEntries.map(([sit, amount]) => {
            const pct = total > 0 ? ((amount / total) * 100).toFixed(2) : '0.00';
            return (
              <div key={sit} className={`rounded px-1.5 py-1 ${situacionClass(sit)}`}>
                <p className="font-medium">{situacionLabel(sit)}</p>
                <p className="mt-0.5">
                  {formatARS(amount)}
                  <span className="ml-1 opacity-70">({pct}%)</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Record<string, unknown>;
}

function makeBarShape(entityName: string) {
  return function CustomBar(rawProps: unknown): React.ReactElement {
    const { x = 0, y = 0, width = 0, height = 0, fill, payload } = rawProps as BarShapeProps;
    if (!width || !height || height < 0) return <g />;
    const problemEntities = payload?._problemEntities as Set<string> | undefined;
    const isProblem = problemEntities?.has(entityName) ?? false;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} />
        {isProblem && (
          <line
            x1={x + width - 1}
            y1={y}
            x2={x + width - 1}
            y2={y + height}
            stroke="rgb(239,68,68)"
            strokeWidth={3}
          />
        )}
      </g>
    );
  };
}

interface MobileTooltipData {
  label: string;
  payload: TooltipPayloadItem[];
}

export function DebtChart({ periodos }: Props) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [mobileTooltip, setMobileTooltip] = useState<MobileTooltipData | null>(null);
  const [hiddenEntities, setHiddenEntities] = useState<Set<string>>(new Set());

  function toggleEntity(name: string) {
    setHiddenEntities(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const sorted = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo));

  const entityTotals = new Map<string, number>();
  for (const p of sorted) {
    for (const e of p.entidades) {
      entityTotals.set(e.entidad, (entityTotals.get(e.entidad) ?? 0) + e.monto);
    }
  }
  const entityNames = Array.from(entityTotals.keys()).sort(
    (a, b) => (entityTotals.get(b) ?? 0) - (entityTotals.get(a) ?? 0)
  );

  const chartData = sorted.map(p => {
    const row: Record<string, unknown> = { period: formatPeriod(p.periodo) };
    const problemEntities = new Set<string>();
    const situations = new Map<string, number>();
    for (const e of p.entidades) {
      row[e.entidad] = ((row[e.entidad] as number) || 0) + e.monto * 1000;
      if (e.situacion >= 2) problemEntities.add(e.entidad);
      // Keep the worst (highest) situation if entity appears multiple times
      situations.set(e.entidad, Math.max(situations.get(e.entidad) ?? 0, e.situacion));
    }
    row._problemEntities = problemEntities;
    row._situations = situations;
    return row;
  });

  const chartHeight = Math.max(280, Math.min(700, entityNames.length * 22 + 140));

  function handleChartClick(data: unknown) {
    if (!isMobile) return;
    const d = data as { activeLabel?: string; activePayload?: TooltipPayloadItem[] };
    if (d.activeLabel && d.activePayload?.length) {
      setMobileTooltip({ label: d.activeLabel, payload: d.activePayload });
    }
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} onClick={handleChartClick}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatARS}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip content={isMobile ? () => null : <CustomTooltip />} cursor={{ fill: 'transparent' }} />
          {entityNames.filter(n => !hiddenEntities.has(n)).map(name => (
            <Bar
              key={name}
              dataKey={name}
              stackId="a"
              fill={getEntityColor(name)}
              shape={makeBarShape(name)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {entityNames.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            onClick={() =>
              setHiddenEntities(
                hiddenEntities.size < entityNames.length
                  ? new Set(entityNames)
                  : new Set()
              )
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {hiddenEntities.size < entityNames.length ? 'Desmarcar todo' : 'Marcar todo'}
          </button>
          {entityNames.map(name => {
            const hidden = hiddenEntities.has(name);
            return (
              <button
                key={name}
                onClick={() => toggleEntity(name)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border border-gray-200 dark:border-gray-700 transition-opacity ${hidden ? 'opacity-40' : 'opacity-100'}`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: getEntityColor(name) }}
                />
                <span className={hidden ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {mobileTooltip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          onClick={() => setMobileTooltip(null)}
        >
          <div onClick={e => e.stopPropagation()}>
            <CustomTooltip active={true} payload={mobileTooltip.payload} label={mobileTooltip.label} />
          </div>
        </div>
      )}
    </>
  );
}
