import React, { useState } from 'react';
import { useNavigation } from '../../hooks/useNavigation';
import { useNavigationContext } from '../../context/NavigationContext';

const ChevronRightIcon = () => (
  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * Recursive Tree Sidebar — renders the Department → Project hierarchy from
 * the Global Active Context. Clicking any node sets the Global Active Context
 * in the URL, which every endpooint inherits for descendant-aware filtering.
 */
const TreeNode = ({ node, depth = 0 }) => {
  const { drillDown, drillUp, filters } = useNavigation();
  const [expanded, setExpanded] = useState(depth < 2);
  const nodeType = node.type || (node.synthetic ? 'department' : 'department');
  const myId = node._id ? String(node._id) : null;

  const isContextNode =
    myId !== null && String(filters.nodeId) === myId && filters.nodeType === nodeType;

  const aggregates = node._aggregates || {};
  const childCount = (node.children || []).length;
  const hasChildren = childCount > 0;

  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleClick = () => {
    if (myId === null) return;
    if (isContextNode) {
      drillUp('nodeId');
    } else {
      drillDown('nodeType', nodeType);
      drillDown('nodeId', myId);
    }
  };

  return (
    <div className="select-none">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors ${
          isContextNode ? 'bg-emerald-100 text-emerald-900 font-semibold' : 'text-slate-600 hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        title={aggregates.totalTasks ? `${aggregates.totalTasks} task(s), ${aggregates.overdueTasks} overdue` : node.name}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={toggleExpand}
            className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span
          className={`w-2 h-2 rounded-sm shrink-0 ${
            nodeType === 'project'
              ? 'bg-indigo-400'
              : 'bg-emerald-500'
          }`}
        />
        <span className="truncate flex-1">{node.name}</span>

        {aggregates.totalTasks > 0 && (
          <span className="text-[10px] text-slate-400 shrink-0">{aggregates.totalTasks}</span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={`${child.type || nodeType}:${child._id || 'root'}-${child.name}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const HierarchySidebar = () => {
  const { hierarchy, loading } = useNavigationContext();
  const { clearAll, filters } = useNavigation();

  const hasContext = Boolean(filters.nodeId);
  const nodeId = filters.nodeId ?? '';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Hierarchy</p>
          <h3 className="text-sm font-semibold text-slate-800 mt-0.5">Organization Tree</h3>
        </div>
      </div>

      <button
        type="button"
        onClick={clearAll}
        className={`m-3 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          !hasContext
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
        }`}
      >
        All Tasks (root)
      </button>

      <div className="flex-1 overflow-y-auto px-2 pb-3 max-h-[calc(100vh-260px)]">
        {hierarchy.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-4">No nodes available.</p>
        ) : (
          hierarchy.map((node) => (
            <TreeNode key={`${node.type || 'department'}:${node._id || 'root'}:${node.name}`} node={node} depth={0} />
          ))
        )}
      </div>
    </div>
  );
};

export default HierarchySidebar;