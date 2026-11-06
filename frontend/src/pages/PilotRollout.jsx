import React, { useEffect, useState } from 'react';
import projectService from '../services/projectService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const PilotRollout = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await projectService.getPortfolioSummary();
        setFlags(['leave_capacity_integration', 'project_migration_tooling', 'workflow_validation_guardrails']);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load pilot config');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="rounded-2xl bg-slate-950 text-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Pilot rollout</p>
        <h1 className="text-3xl font-bold mt-2">Controlled rollout configuration</h1>
      </div>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap gap-2">
          {flags.map((flag) => (
            <span key={flag} className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700">{flag}: enabled</span>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">Rollout remains limited to the approved pilot set until operational feedback confirms safe expansion.</p>
      </div>
    </div>
  );
};

export default PilotRollout;
