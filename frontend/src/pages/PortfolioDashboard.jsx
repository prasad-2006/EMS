import React, { useEffect, useState } from 'react';
import projectService from '../services/projectService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const PortfolioDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const response = await projectService.getPortfolioSummary();
      setSummary(response?.data || null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load portfolio summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const totals = summary?.totals || {};
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950 to-teal-900 text-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Portfolio governance</p>
        <h1 className="text-3xl font-bold mt-1">Executive Delivery Portfolio</h1>
        <p className="text-cyan-100/80 mt-2">Delivery health, active work, risks, and issues across the organization.</p>
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Projects', totals.projects, 'bg-slate-50'], ['Active', totals.active, 'bg-emerald-50'], ['At risk', totals.atRisk, 'bg-rose-50'], ['Open risks', totals.openRisks, 'bg-amber-50'], ['Open issues', totals.openIssues, 'bg-orange-50']].map(([label, value, style]) => <div key={label} className={`rounded-xl border border-slate-200 p-4 ${style}`}><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value || 0}</p></div>)}
      </div>
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200"><h2 className="text-lg font-semibold text-slate-900">Projects requiring attention</h2><p className="text-sm text-slate-500 mt-1">Projects past their planned end date without a completed or cancelled status.</p></div>
        <div className="divide-y divide-slate-200">{(summary?.atRiskProjects || []).map((project) => <div key={project._id} className="p-4 flex items-center justify-between gap-3"><div><p className="font-medium text-slate-900">{project.name}</p><p className="text-xs text-slate-500 mt-1">{project.workflowStatus} · Due {new Date(project.endDate).toLocaleDateString()}</p></div><a href={`/admin/projects/${project._id}`} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">Open workspace</a></div>)}{(summary?.atRiskProjects || []).length === 0 && <p className="p-8 text-center text-sm text-slate-500">No projects currently require escalation.</p>}</div>
      </section>
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><h2 className="text-lg font-semibold text-slate-900">Task status across portfolio</h2><div className="mt-4 flex flex-wrap gap-3">{(summary?.taskStats || []).map((stat) => <span key={stat._id} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">{stat._id}: {stat.count}</span>)}</div></section>
    </div>
  );
};

export default PortfolioDashboard;
