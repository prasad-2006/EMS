import React from 'react';
import { useNavigation } from '../../hooks/useNavigation';

const CARD_CONFIG = [
  {
    key: 'total',
    label: 'Total Tasks',
    count: (kpi) => kpi?.total,
    className: 'border-slate-200 bg-white text-slate-900',
    countClass: 'text-slate-900',
    alwaysVisible: true
  },
  {
    key: 'overdue',
    label: 'Overdue',
    count: (kpi) => kpi?.overdue,
    filter: { status: 'overdue' },
    className: 'border-red-200 bg-red-50',
    countClass: 'text-red-700',
    hint: 'status=overdue'
  },
  {
    key: 'active',
    label: 'Active',
    count: (kpi) => kpi?.active,
    className: 'border-blue-200 bg-blue-50',
    countClass: 'text-blue-700'
  },
  {
    key: 'high',
    label: 'High Priority',
    count: (kpi) => kpi?.byPriority?.high,
    filter: { priority: 'high' },
    className: 'border-orange-200 bg-orange-50',
    countClass: 'text-orange-700',
    hint: 'priority=high'
  },
  {
    key: 'critical',
    label: 'Critical',
    count: (kpi) => kpi?.byPriority?.critical,
    filter: { priority: 'critical' },
    className: 'border-rose-300 bg-rose-50',
    countClass: 'text-rose-700',
    hint: 'priority=critical'
  },
  {
    key: 'done',
    label: 'Completed',
    count: (kpi) => kpi?.byStatus?.done,
    filter: { status: 'done' },
    className: 'border-emerald-200 bg-emerald-50',
    countClass: 'text-emerald-700',
    hint: 'status=done'
  }
];

/**
 * Interactive KPI Cards — replaces the static "Showing X of Y" counter.
 * Every metric card appends its criterion to the active drill-down stack;
 * clicking an already-active card removes it (drill up).
 */
const KpiCards = ({ kpi, loading }) => {
  const { drillDown, drillUp, isActive } = useNavigation();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {CARD_CONFIG.map((card) => {
        const count = card.count(kpi) ?? 0;
        const active = card.filter && isActive(card.filter.key, card.filter.value);
        const interactive = Boolean(card.filter);

        return (
          <button
            key={card.key}
            type="button"
            disabled={!interactive && !card.alwaysVisible}
            onClick={() => {
              if (!card.filter) return;
              if (active) {
                drillUp(card.filter.key);
              } else {
                drillDown(card.filter.key, card.filter.value);
              }
            }}
            className={`relative rounded-xl border p-3 text-left transition-all ${
              interactive ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
            } ${active ? 'ring-2 ring-blue-500 border-blue-300' : ''} ${card.className}`}
            title={card.hint || `${card.label} within current drill context`}
          >
            {active && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" title="Active filter — click to remove" />
            )}
            <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.countClass}`}>
              {loading ? '—' : count}
            </p>
            {card.key === 'total' && (
              <p className="text-[10px] text-slate-400 mt-0.5">within current context</p>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default KpiCards;
