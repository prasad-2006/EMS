import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigationContext } from '../context/NavigationContext';

export const FILTER_KEYS = ['nodeType', 'nodeId', 'status', 'priority', 'category', 'assignee', 'q'];

// Order defines the drill-depth ordering used by the Breadcrumb.
export const FILTER_ORDER = ['node', 'status', 'priority', 'category', 'assignee', 'q'];

const KEY_TITLES = {
  node: 'Context',
  status: 'Status',
  priority: 'Priority',
  category: 'Category',
  assignee: 'Assignee',
  q: 'Search'
};

const STATUS_LABELS = {
  overdue: 'Overdue',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled'
};

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

const CATEGORY_LABELS = {
  development: 'Development',
  design: 'Design',
  testing: 'Testing',
  documentation: 'Documentation',
  meeting: 'Meeting',
  admin: 'Admin',
  other: 'Other'
};

const toLabel = (key, value) => {
  if (key === 'status') return STATUS_LABELS[value] || value;
  if (key === 'priority') return PRIORITY_LABELS[value] || value;
  if (key === 'category') return CATEGORY_LABELS[value] || value;
  return value;
};

/**
 * useNavigation — URL as the Source of Truth for every drill-down action.
 *
 * The accumulated filter stack lives entirely in the URL query params
 * (?nodeType=&nodeId=&status=&priority=&category=&assignee=&q=). Refreshing the
 * page restores the exact drill depth. Segments are ordered so that "drill
 * up" from a breadcrumb simply removes every deeper segment.
 */
export const useNavigation = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeNode, findNode } = useNavigationContext();

  // ---- Current filter stack ----
  const filters = useMemo(() => {
    const result = {};
    FILTER_KEYS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    });
    return result;
  }, [searchParams]);

  // ---- Drill down: append (or replace) a single criterion to the URL ----
  const drillDown = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      next.delete('page'); // reset pagination on any drill change
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  // ---- Drill up: remove a single criterion from the URL ----
  const drillUp = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      if (key === 'nodeId') next.delete('nodeType');
      next.delete('page');
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  // ---- Breadcrumb semantics: click a segment to revert to that depth. ----
  const drillUpTo = useCallback(
    (segmentIndex) => {
      const next = new URLSearchParams(searchParams);
      FILTER_ORDER.slice(segmentIndex).forEach((group) => {
        FILTER_KEYS.forEach((key) => {
          if (key.startsWith('node')) {
            if (group === 'node') next.delete(key);
          } else if (key === group) {
            next.delete(key);
          }
        });
      });
      next.delete('page');
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  // ---- Reset everything ----
  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: false });
  }, [setSearchParams]);

  // ---- Ordered breadcrumb segments for the current stack ----
  const segments = useMemo(() => {
    const list = [];

    if (filters.nodeId) {
      const nodeType = filters.nodeType || 'department';
      const node = activeNode && !activeNode.unresolved ? activeNode : findNode(nodeType, filters.nodeId);
      list.push({
        group: 'node',
        key: 'node',
        type: nodeType,
        id: filters.nodeId,
        label: node?.name || nodeType === 'project' ? 'Project' : 'Department',
        title: nodeType === 'project' ? `Project: ${node?.name || filters.nodeId}` : `Department: ${node?.name || filters.nodeId}`
      });
    }

    if (filters.status) {
      const values = String(filters.status).split(',');
      list.push({
        group: 'status',
        key: 'status',
        label: values.length === 1 ? toLabel('status', values[0]) : `${values.length} statuses`,
        title: values.map((v) => toLabel('status', v)).join(', ')
      });
    }

    if (filters.priority) {
      const values = String(filters.priority).split(',');
      list.push({
        group: 'priority',
        key: 'priority',
        label: values.length === 1 ? toLabel('priority', values[0]) : `${values.length} priorities`,
        title: values.map((v) => toLabel('priority', v)).join(', ')
      });
    }

    if (filters.category) {
      const values = String(filters.category).split(',');
      list.push({
        group: 'category',
        key: 'category',
        label: values.length === 1 ? toLabel('category', values[0]) : `${values.length} categories`,
        title: values.map((v) => toLabel('category', v)).join(', ')
      });
    }

    if (filters.assignee) {
      list.push({
        group: 'assignee',
        key: 'assignee',
        label: 'Assignee',
        title: `Assignee: ${filters.assignee}`
      });
    }

    if (filters.q) {
      list.push({
        group: 'q',
        key: 'q',
        label: `"${filters.q}"`,
        title: `Search: ${filters.q}`
      });
    }

    return list;
  }, [filters, findNode]);

  const isActive = useCallback(
    (key, value) => {
      if (!value) return false;
      const current = searchParams.get(key);
      if (!current) return false;
      return String(current).split(',').includes(String(value));
    },
    [searchParams]
  );

  return {
    filters,
    searchParams,
    setSearchParams,
    drillDown,
    drillUp,
    drillUpTo,
    clearAll,
    segments,
    isActive,
    activeNode
  };
};