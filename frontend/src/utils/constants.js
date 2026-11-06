// Token keys for localStorage - separate keys for admin and employee sessions
export const TOKEN_KEY = 'vacation_tracking_token';
export const ADMIN_TOKEN_KEY = 'vacation_tracking_admin_token';
export const EMPLOYEE_TOKEN_KEY = 'vacation_tracking_employee_token';

export const LEAVE_TYPES = {
  CASUAL: 'casual',
  SICK: 'sick',
  EARNED: 'earned',
  WFH: 'wfh',
  EMERGENCY: 'emergency'
};

export const LEAVE_TYPE_LABELS = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  earned: 'Earned Leave',
  wfh: 'Work From Home',
  emergency: 'Emergency Leave'
};

export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  HR: 'hr',
  ADMIN: 'admin',
  AUDITOR: 'auditor'
};

export const ROLE_LABELS = {
  employee: 'Employee',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Admin',
  auditor: 'Auditor'
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please login again.',
  SERVER_ERROR: 'Server error. Please try again later.'
};

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  API: 'yyyy-MM-dd',
  FULL: 'MMMM dd, yyyy'
};

export const HOLIDAY_TYPES = {
  NATIONAL: 'national',
  COMPANY: 'company',
  OPTIONAL: 'optional'
};

export const APPROVAL_LEVELS = {
  MANAGER: 'manager',
  HR: 'hr',
  ADMIN: 'admin'
};
