import React from 'react';
import { useNavigation } from '../../hooks/useNavigation';

const ChevronIcon = () => (
  <svg className="w-4 h-4 mx-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * Dynamic Breadcrumb — maps the current drill-down filter stack into
 * clickable segments. Each segment visually represents one drill depth;
 * clicking it performs a "drill up" (removes every deeper segment).
 */
const Breadcrumb = ({ userLookup = {} }) => {
  const { segments, drillUpTo, clearAll, filters } = useNavigation();

  const resolvedSegments = segments.map((segment) => {
    if (segment.group === 'assignee') {
      const name = userLookup[segment.id]?.name;
      return { ...segment, label: name ? `Assignee: ${name}` : 'Assignee' };
    }
    return segment;
  });

  const hasFilters = resolvedSegments.length > 0 || filters.q;

  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-2.5">
      <button
        type="button"
        onClick={clearAll}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
          !hasFilters
            ? 'text-emerald-700 bg-emerald-50'
            : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
        }`}
        title="Reset to root view"
      >
        {!hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        All Tasks
      </button>

      {resolvedSegments.map((segment, index) => (
        <React.Fragment key={`${segment.group}-${index}`}>
          <ChevronIcon />
          <button
            type="button"
            onClick={() => drillUpTo(index)}
            title={`Drill up: remove ${segment.title || segment.label}`}
            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
              index === resolvedSegments.length - 1
                ? 'text-blue-700 bg-blue-50 border border-blue-200'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            {segment.label}
            <span className="text-slate-400 group-hover:text-blue-500">
              <XIcon />
            </span>
          </button>
        </React.Fragment>
      ))}

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto text-xs text-slate-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          Clear all
        </button>
      )}
    </nav>
  );
};

export default Breadcrumb;
