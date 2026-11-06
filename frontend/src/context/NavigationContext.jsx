import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import hierarchyService from '../services/hierarchyService';

const NavigationContext = createContext(null);

export const useNavigationContext = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within NavigationProvider');
  }
  return context;
};

/**
 * Global Active Context Provider.
 *
 * Holds the hierarchical Department/Project tree (fetched once via the
 * $graphLookup /api/hierarchy endpoint) and exposes the "Global Active
 * Context" node derived from the URL (?nodeType=department&nodeId=...).
 * The active node is consumed by every drillable surface (task table,
 * breadcrumb, KPI cards, redistribution board, projects view).
 */
export const NavigationProvider = ({ children }) => {
  const [searchParams] = useSearchParams();
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await hierarchyService.getHierarchy();
      setHierarchy(Array.isArray(response?.data) ? response.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const refreshOnNavigation = () => refresh();
    window.addEventListener('focus', refreshOnNavigation);
    window.addEventListener('ems:hierarchy-refresh', refreshOnNavigation);

    return () => {
      window.removeEventListener('focus', refreshOnNavigation);
      window.removeEventListener('ems:hierarchy-refresh', refreshOnNavigation);
    };
  }, [refresh]);

  // Depth-first lookup of a node by id within the combined tree.
  const findNode = useCallback(
    (type, id) => {
      if (id === undefined || id === null || id === '') return null;
      const search = (nodes) => {
        for (const node of nodes) {
          if (String(node._id) === String(id)) {
            return { ...node, type: type || node.type || 'department' };
          }
          if (node.children && node.children.length > 0) {
            const found = search(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return search(hierarchy);
    },
    [hierarchy]
  );

  // Global Active Context — always derived from the URL (source of truth).
  const activeNode = useMemo(() => {
    const nodeType = searchParams.get('nodeType');
    const nodeId = searchParams.get('nodeId');
    if (!nodeType || !nodeId) return null;
    const node = findNode(nodeType, nodeId);
    if (node) return node;
    // Fall back to a label-only node (context may not have loaded yet).
    return { _id: nodeId, name: nodeId, type: nodeType, unresolved: true };
  }, [searchParams, findNode]);

  const value = useMemo(
    () => ({
      hierarchy,
      loading,
      error,
      refresh,
      findNode,
      activeNode
    }),
    [hierarchy, loading, error, refresh, findNode, activeNode]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
