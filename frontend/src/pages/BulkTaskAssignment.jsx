import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import taskService from '../services/taskService';
import CascadingAssign from '../components/Tasks/CascadingAssign';

// Icons
const UploadIcon = () => (
  <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const BulkTaskAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('upload'); // upload, smart-assign, preview, results
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const downloadTemplate = () => {
    // Template matching the day-wise format from the provided sheet.
    const template = `Email,Password,Department,Day 1 Task,Day 2 Task,Day 3 Task,Day 4 Task,Day 5 Task,Day 6 Task,Day 7 Task
employee1@example.invalid,REPLACE_WITH_PASSWORD,IT,Setup development environment,Fix minor bugs in codebase,Implement API endpoint,Database schema update,Code optimization,Write unit tests,Deploy to staging server
employee2@example.invalid,REPLACE_WITH_PASSWORD,Marketing,Market research analysis,Create social media plan,Design campaign strategy,Content creation,SEO optimization,Run ad campaign,Performance analysis report
employee3@example.invalid,REPLACE_WITH_PASSWORD,Support,Handle support tickets,Resolve customer queries,Update FAQ section,Call customer follow-up,Bug reporting to IT,Customer satisfaction survey,Weekly support report`;

    // Create blob and download
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'task-assignment-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Template downloaded! Fill it and upload as .xlsx');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                         'application/vnd.ms-excel',
                         'text/csv'];
      
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload an Excel or CSV file.');
        return;
      }

      setSelectedFile(file);
      setResults(null);
      setActiveTab('preview');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect({ target: { files: [file] } });
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setImporting(true);
      console.log('Starting import with file:', selectedFile.name);
      
      const response = await taskService.bulkImportTasks(selectedFile);

      const envelope = response || {};
      const resultsData = envelope.data || envelope;

      if (envelope?.success !== false && resultsData) {
        setResults(resultsData);
        setActiveTab('results');
        toast.success(envelope?.message || 'Import completed!');
      } else {
        toast.error(envelope?.error || 'Import failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import tasks');
    } finally {
      setImporting(false);
    }
  };

  const handleNewImport = () => {
    setSelectedFile(null);
    setResults(null);
    setActiveTab('upload');
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Task Assignment</h1>
          <p className="text-gray-600">Upload an Excel file to assign multiple tasks to employees at once</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('smart-assign')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'smart-assign'
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Smart Assign
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            disabled={!selectedFile}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('results')}
            disabled={!results}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'results'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed'
            }`}
          >
            Results
          </button>
        </div>

        {/* Smart Assign Tab */}
        {activeTab === 'smart-assign' && (
          <div className="max-w-3xl mx-auto">
            <CascadingAssign
              onAssigned={() => {
                setActiveTab('upload');
              }}
            />
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-white hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <UploadIcon />
              <p className="mt-4 text-lg font-medium text-gray-900">Drop your Excel file here</p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
              <p className="mt-4 text-xs text-gray-400">Supports: .xlsx, .xls, .csv (Max 50MB)</p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Excel File Format</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p className="font-medium">Your Excel file should contain these columns:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><span className="font-medium">Email</span> (required) - Employee email</li>
                  <li><span className="font-medium">Password</span> (required only if user does not exist) - Used to auto-create missing users</li>
                  <li><span className="font-medium">Department</span> (optional) - Existing department name, or auto-created if missing</li>
                  <li><span className="font-medium">Day 1 Task</span> to <span className="font-medium">Day 7 Task</span> (at least one required) - One task per non-empty day cell</li>
                </ul>
              </div>
            </div>

            {/* Template Button */}
            <button
              onClick={downloadTemplate}
              className="flex items-center justify-center w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <DownloadIcon />
              <span className="ml-2">Download Template</span>
            </button>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && selectedFile && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">File Selected</h3>
              <div className="flex items-center p-4 bg-gray-50 rounded border border-gray-200">
                <DocumentIcon />
                <div className="ml-4">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p className="font-medium mb-2">Before importing:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Keep headers exactly as: Email, Password, Department, Day 1 Task ... Day 7 Task</li>
                <li>If a user already exists, Password can be left blank</li>
                <li>At least one day task cell must be filled in each row</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('upload')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Choose Different File
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  'Import Tasks'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && !results && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">No import results available</p>
            <p className="text-gray-400 mt-2">Please import a file first</p>
          </div>
        )}

        {activeTab === 'results' && results && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-gray-600 text-sm font-medium">Total Processed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{results.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg border border-green-200 p-6">
                <p className="text-green-600 text-sm font-medium">Successful</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{results.success.length}</p>
              </div>
              <div className="bg-red-50 rounded-lg border border-red-200 p-6">
                <p className="text-red-600 text-sm font-medium">Failed</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{results.failed.length}</p>
              </div>
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <p className="text-blue-600 text-sm font-medium">Users Created</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{results.usersCreated || 0}</p>
              </div>
            </div>

            {/* Success Results */}
            {results.success.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-green-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-green-900">Successfully Imported Tasks</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {results.success.map((item, idx) => (
                    <div key={idx} className="px-6 py-4 flex items-start">
                      <CheckIcon />
                      <div className="ml-4 flex-1">
                        <p className="font-medium text-gray-900">{item.taskTitle}</p>
                        <p className="text-sm text-gray-600">Assigned to: {item.assignedTo}</p>
                        <p className="text-xs text-gray-500 mt-1">Task ID: {item.taskId}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Results */}
            {results.failed.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-red-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-red-900">Failed Imports</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {results.failed.map((item, idx) => (
                    <div key={idx} className="px-6 py-4 flex items-start">
                      <ErrorIcon />
                      <div className="ml-4 flex-1">
                        <p className="font-medium text-gray-900">Row {item.row}</p>
                        <p className="text-sm text-red-600 mt-1">{item.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleNewImport}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Import Another File
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className="flex-1 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back to Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkTaskAssignment;
