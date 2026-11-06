import React, { useState } from 'react';
import toast from 'react-hot-toast';
import projectService from '../../services/projectService';

const ProjectCreateModal = ({ onClose, onSaved, departments, project = null }) => {
  const [form, setForm] = useState({
    name: project?.name || '',
    code: project?.code || '',
    description: project?.description || '',
    departmentId: project?.assignedDepartment?._id || project?.assignedDepartment || project?.departmentId || '',
    status: project?.status || 'planned',
    startDate: project?.startDate ? String(project.startDate).slice(0, 10) : '',
    endDate: project?.endDate ? String(project.endDate).slice(0, 10) : ''
  });
  const [saving, setSaving] = useState(false);
  const [document, setDocument] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');
    
    try {
      setSaving(true);
      if (form.startDate && form.endDate && form.endDate < form.startDate) {
        return toast.error('End date must be after the start date');
      }

      if (project) {
        await projectService.updateProject(project._id, {
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim(),
          departmentId: form.departmentId || null,
          assignedDepartment: form.departmentId || null,
          status: form.status,
          startDate: form.startDate || null,
          endDate: form.endDate || null
        });
        toast.success('Project updated successfully');
      } else {
        const projectData = new FormData();
        projectData.append('name', form.name.trim());
        projectData.append('code', form.code.trim());
        projectData.append('description', form.description.trim());
        if (form.departmentId) projectData.append('departmentId', form.departmentId);
        projectData.append('status', form.status);
        if (form.startDate) projectData.append('startDate', form.startDate);
        if (form.endDate) projectData.append('endDate', form.endDate);
        if (document) projectData.append('document', document);
        await projectService.createProject(projectData);
        toast.success('Project created successfully');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{project ? 'Edit Project' : 'Create New Project'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. B2B Wholesale Portal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Code</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. PRJ-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Project description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Department</label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No specific department (Global)</option>
              {departments?.map(dept => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {!project && <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Document</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.md,.txt"
              onChange={(e) => setDocument(e.target.files?.[0] || null)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:rounded file:text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Optional. PDF, Word, Excel, CSV, Markdown, or text file up to 50 MB.</p>
            {document && <p className="text-xs text-slate-600 mt-1 truncate">Selected: {document.name}</p>}
          </div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (project ? 'Saving...' : 'Creating...') : (project ? 'Save Changes' : 'Create Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreateModal;
