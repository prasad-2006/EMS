import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { NavigationProvider } from './context/NavigationContext';
import PrivateRoute from './components/Common/PrivateRoute';
import EmployeeLayout from './components/Layout/EmployeeLayout';
import AdminLayout from './components/Layout/AdminLayout';
import HRLayout from './components/Layout/HRLayout';

// Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ApplyLeave from './pages/ApplyLeave';
import LeaveHistory from './pages/LeaveHistory';
import EmployeeLeaveCalendar from './pages/EmployeeLeaveCalendar';
import NotificationsCenter from './pages/NotificationsCenter';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ManageRequests from './pages/ManageRequests';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Holidays from './pages/Holidays';
import TeamAvailability from './pages/TeamAvailability';
import Reports from './pages/Reports';
import LeaveRequestDetails from './pages/LeaveRequestDetails';
import Settings from './pages/Settings';
import EmployeeHandover from './pages/EmployeeHandover';
import BackupDashboard from './pages/BackupDashboard';
import ReturnToWork from './pages/ReturnToWork';
import BulkTaskAssignment from './pages/BulkTaskAssignment';
import AdminTaskManagement from './pages/AdminTaskManagement';
import EmployeeAssignedTasks from './pages/EmployeeAssignedTasks';
import Projects from './pages/Projects';
import AuditLogs from './pages/AuditLogs';
import HandoverVerification from './pages/HandoverVerification';
import WorkflowTracker from './pages/WorkflowTracker';
import TaskRedistribution from './pages/TaskRedistribution';
import FinancialLedger from './pages/FinancialLedger';
import ProjectWorkflow from './pages/ProjectWorkflow';
import ProjectWorkspace from './pages/ProjectWorkspace';
import PortfolioDashboard from './pages/PortfolioDashboard';
import PilotRollout from './pages/PilotRollout';

function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            boxShadow: '0 12px 26px rgba(15, 23, 42, 0.1)',
            borderRadius: '12px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#0f766e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#e11d48',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <NavigationProvider>
        <Routes>
          {/* Login */}
          <Route path="/login" element={<Login />} />

          {/* Password Recovery */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          
          {/* Root redirect - prioritize based on session */}
          <Route path="/" element={
            user?.role === 'admin' 
              ? <Navigate to="/admin/dashboard" replace />
              : user?.role === 'hr'
                ? <Navigate to="/hr/dashboard" replace />
                : user 
                  ? <Navigate to="/dashboard" replace />
                  : <Navigate to="/login" replace />
          } />
          
          {/* Employee Routes (Employee & Manager) */}
          <Route element={<PrivateRoute requiredRole={['employee', 'manager']} />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/dashboard" element={<EmployeeDashboard />} />
              <Route path="/apply-leave" element={<ApplyLeave />} />
              <Route path="/leave-history" element={<LeaveHistory />} />
              <Route path="/leave-calendar" element={<EmployeeLeaveCalendar />} />
              <Route path="/notifications" element={<NotificationsCenter />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/tasks" element={<EmployeeAssignedTasks />} />
              <Route path="/tasks/:taskId" element={<EmployeeAssignedTasks />} />
              <Route path="/employee/tasks" element={<EmployeeAssignedTasks />} />
              <Route path="/employee/tasks/:taskId" element={<EmployeeAssignedTasks />} />
              <Route path="/employee/handover" element={<EmployeeHandover />} />
              <Route path="/employee/handover/:leaveId" element={<EmployeeHandover />} />
              <Route path="/employee/backup" element={<BackupDashboard />} />
              <Route path="/employee/return" element={<ReturnToWork />} />
              <Route path="/employee/return/:leaveId" element={<ReturnToWork />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectWorkspace />} />
              <Route path="/manager/projects" element={<ProjectWorkflow />} />
              <Route path="/manager/employees" element={<Employees />} />
            </Route>
          </Route>

          {/* HR Routes */}
          <Route element={<PrivateRoute requiredRole="hr" />}>
            <Route element={<HRLayout />}>
              <Route path="/hr/dashboard" element={<AdminDashboard />} />
              <Route path="/hr/notifications" element={<NotificationsCenter />} />
              <Route path="/hr/requests" element={<ManageRequests />} />
              <Route path="/hr/requests/:id" element={<LeaveRequestDetails />} />
              <Route path="/hr/requests/profile/:userId" element={<LeaveRequestDetails />} />
              <Route path="/hr/employees" element={<Employees />} />
              <Route path="/hr/team-availability" element={<TeamAvailability />} />
              <Route path="/hr/reports" element={<Reports />} />
              <Route path="/hr/settings" element={<Settings />} />
              <Route path="/hr/projects" element={<ProjectWorkflow />} />
              <Route path="/hr/projects/:id" element={<ProjectWorkspace />} />
            </Route>
          </Route>
          
          {/* Admin Routes */}
          <Route element={<PrivateRoute requiredRole="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/portfolio" element={<PortfolioDashboard />} />
              <Route path="/admin/pilot-rollout" element={<PilotRollout />} />
              <Route path="/admin/notifications" element={<NotificationsCenter />} />
              <Route path="/admin/manager-dashboard" element={<ManagerDashboard />} />
              <Route path="/admin/requests" element={<ManageRequests />} />
              <Route path="/admin/requests/:id" element={<LeaveRequestDetails />} />
              <Route path="/admin/requests/profile/:userId" element={<LeaveRequestDetails />} />
              <Route path="/admin/employees" element={<Employees />} />
              <Route path="/admin/departments" element={<Departments />} />
              <Route path="/admin/holidays" element={<Holidays />} />
              <Route path="/admin/team-availability" element={<TeamAvailability />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/bulk-tasks" element={<BulkTaskAssignment />} />
              <Route path="/admin/tasks" element={<AdminTaskManagement />} />
              <Route path="/admin/task-redistribution" element={<TaskRedistribution />} />
              <Route path="/admin/projects" element={<Projects />} />
              <Route path="/admin/projects/:id" element={<ProjectWorkspace />} />
              <Route path="/admin/project-workflow" element={<ProjectWorkflow />} />
              <Route path="/admin/handover-verification" element={<HandoverVerification />} />
              <Route path="/admin/workflow" element={<WorkflowTracker />} />
              <Route path="/admin/audit-logs" element={<AuditLogs />} />
              <Route path="/admin/ledger" element={<FinancialLedger />} />
              <Route path="/admin/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </NavigationProvider>
    </>
  );
}

export default App;
