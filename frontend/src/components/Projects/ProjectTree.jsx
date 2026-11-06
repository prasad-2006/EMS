import React from 'react';
import { FiTrendingUp } from 'react-icons/fi';

/**
 * Nested Aggregation View — parent Project cards display aggregated metrics
 * (progress %, total task count, members on leave) rolled up from every child
 * node in their subtree. The progress bar is clickable and triggers the Gantt
 * deep drill for that project node.
 */
const ProjectCard = ({ node, depth = 0, onOpenGantt }) => {
  const aggregates = node._aggregates || {};
  const progress = node.progressPercentage ?? aggregates.progressPercentage ?? 0;
  const hasChildren = (node.children || []).length > 0;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 transition-shadow hover:shadow-md"
      style={{ marginLeft: `${depth * 28}px` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
            <h3 className="text-lg font-semibold text-slate-900">{node.name}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
              {depth === 0 ? 'Parent' : `Level ${depth}`}
            </span>
          </div>
          {node.code && <p className="text-xs text-slate-400 mt-0.5">{node.code}</p>}
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            aggregates.overdueTasks > 0
              ? 'bg-orange-50 text-orange-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {aggregates.overdueTasks > 0 ? `${aggregates.overdueTasks} overdue` : 'On track'}
        </span>
      </div>

      {/* Clickable progress bar → Gantt deep drill */}
      <button
        type="button"
        onClick={() => onOpenGantt(node)}
        className="mt-4 w-full group text-left"
        title="Click to open the Gantt deep drill for this project node"
      >
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="flex items-center gap-1.5 group-hover:text-blue-700 transition-colors">
            <FiTrendingUp size={12} />
            Progress (incl. sub-projects)
          </span>
          <span className="font-bold text-slate-700 group-hover:text-blue-700">{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </button>

      {/* Aggregated stats */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-lg font-bold text-slate-800">{aggregates.totalTasks || 0}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Tasks</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2">
          <p className="text-lg font-bold text-blue-700">{aggregates.activeTasks || 0}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Active</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <p className="text-lg font-bold text-emerald-700">{aggregates.doneTasks || 0}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Completed</p>
        </div>
        <div className="rounded-lg bg-rose-50 p-2">
          <p className="text-lg font-bold text-rose-600">{aggregates.membersOnLeave || 0}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">On Leave</p>
        </div>
      </div>

      {hasChildren && (
        <div className="mt-3 border-l-2 border-slate-100 pl-3 space-y-3">
          {node.children.map((child) => (
            <ProjectCard key={String(child._id)} node={child} depth={depth + 1} onOpenGantt={onOpenGantt} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ProjectTree — renders the nested project hierarchy as indented aggregated
 * cards, preserving each sub-project under its parent project card (departments
 * act as grouping containers).
 */
const ProjectTree = ({ roots, onOpenGantt }) => {
  if (!roots || roots.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
        No projects found in the current hierarchy.
      </div>
    );
  }

  const sections = [];
  const walk = (nodes) => {
    nodes.forEach((node) => {
      if (node.type === 'project') {
        sections.push(node);
      }
      if (node.children) walk(node.children);
    });
  };
  roots.forEach((dept) => walk(dept.children || []));

  return (
    <div className="space-y-5">
      {sections.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No projects found under the current scope.
        </div>
      ) : (
        sections.map((node) => (
          <ProjectCard key={String(node._id)} node={node} depth={0} onOpenGantt={onOpenGantt} />
        ))
      )}
    </div>
  );
};

export default ProjectTree;