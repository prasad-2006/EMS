import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { updateMyProfile } from '../services/userService';
import { getSettings, updateSettings } from '../services/settingsService';
import { getSessions, revokeSession, revokeOtherSessions, setupMfa, verifyMfa, disableMfa } from '../services/accountSecurityService';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getAppearancePreferences,
  updateAppearancePreferences
} from '../services/userPreferencesService';
import { getPrivacySummary, getPrivacyRequests, requestDataExport, requestAccountAction } from '../services/privacyService';

const FONT_SIZE_KEY = 'vts.appearance.fontScale';
const REDUCED_MOTION_KEY = 'vts.appearance.reducedMotion';
const EMAIL_REMINDER_KEY = 'vts.preferences.emailReminders';
const DESKTOP_ALERTS_KEY = 'vts.preferences.desktopAlerts';

const readBoolean = (key, fallback = false) => {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
};

const Settings = () => {
  const { user, refreshSessionUser, logout, isAdmin } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [privacyRequests, setPrivacyRequests] = useState([]);
  const [privacySummary, setPrivacySummary] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [globalConfig, setGlobalConfig] = useState({ leaveTaskDeductionPercentage: 10 });
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    designation: user?.designation || '',
    alternateEmail: user?.alternateEmail || '',
    address: {
      city: user?.address?.city || '',
      state: user?.address?.state || '',
      country: user?.address?.country || 'India'
    },
    emergencyContact: {
      name: user?.emergencyContact?.name || '',
      relationship: user?.emergencyContact?.relationship || '',
      phoneNumber: user?.emergencyContact?.phoneNumber || ''
    },
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const [appearance, setAppearance] = useState({
    fontScale: localStorage.getItem(FONT_SIZE_KEY) || 'normal',
    reducedMotion: readBoolean(REDUCED_MOTION_KEY)
  });

  const [preferences, setPreferences] = useState({
    emailReminders: readBoolean(EMAIL_REMINDER_KEY, true),
    desktopAlerts: readBoolean(DESKTOP_ALERTS_KEY, true)
  });

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
      designation: user?.designation || '',
      alternateEmail: user?.alternateEmail || '',
      address: {
        city: user?.address?.city || '',
        state: user?.address?.state || '',
        country: user?.address?.country || 'India'
      },
      emergencyContact: {
        name: user?.emergencyContact?.name || '',
        relationship: user?.emergencyContact?.relationship || '',
        phoneNumber: user?.emergencyContact?.phoneNumber || ''
      },
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    });
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      getSettings().then(res => {
        if (res.data?.data) {
          setGlobalConfig(res.data.data);
        }
      }).catch(err => console.error(err));
    }
  }, [isAdmin]);

  useEffect(() => {
    const loadAccountSettings = async () => {
      try {
        const [notificationResponse, appearanceResponse, sessionResponse, privacyResponse, privacyRequestsResponse] = await Promise.all([
          getNotificationPreferences(),
          getAppearancePreferences(),
          getSessions(),
          getPrivacySummary(),
          getPrivacyRequests()
        ]);
        const notificationData = notificationResponse.data || {};
        const appearanceData = appearanceResponse.data || {};
        setPreferences({
          emailReminders: notificationData.categories?.reminders ?? true,
          desktopAlerts: notificationData.channels?.inApp ?? true
        });
        setAppearance({
          fontScale: appearanceData.fontScale || 'normal',
          reducedMotion: appearanceData.reducedMotion || false
        });
        setSessions(sessionResponse.data || []);
        setPrivacySummary(privacyResponse.data);
        setPrivacyRequests(privacyRequestsResponse.data || []);
        setPreferencesLoaded(true);
      } catch (error) {
        console.error('Failed to load account settings:', error);
      }
    };
    loadAccountSettings();
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const root = document.documentElement;
    if (appearance.fontScale === 'compact') {
      root.style.fontSize = '14px';
    } else if (appearance.fontScale === 'large') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '16px';
    }

    if (appearance.reducedMotion) {
      document.body.classList.add('vts-reduced-motion');
    } else {
      document.body.classList.remove('vts-reduced-motion');
    }

    localStorage.setItem(FONT_SIZE_KEY, appearance.fontScale);
    localStorage.setItem(REDUCED_MOTION_KEY, String(appearance.reducedMotion));
    updateAppearancePreferences(appearance).catch((error) => {
      console.error('Failed to save appearance preferences:', error);
    });
  }, [appearance, preferencesLoaded]);

  const updateAddressField = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }));
  };

  const updateEmergencyField = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value
      }
    }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmNewPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSavingProfile(true);

    try {
      await updateMyProfile({
        name: profileForm.name,
        email: profileForm.email,
        phoneNumber: profileForm.phoneNumber,
        designation: profileForm.designation,
        alternateEmail: profileForm.alternateEmail,
        address: profileForm.address,
        emergencyContact: profileForm.emergencyContact,
        currentPassword: profileForm.currentPassword,
        newPassword: profileForm.newPassword
      });
      if (profileForm.newPassword) {
        logout();
        window.location.href = '/login';
        return;
      }
      await refreshSessionUser();
      toast.success('Profile updated successfully');
      setProfileForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const togglePreference = (field) => {
    setPreferences((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      setSavingPreferences(true);
      updateNotificationPreferences({
        channels: { inApp: next.desktopAlerts, email: next.emailReminders },
        categories: { reminders: next.emailReminders }
      }).catch((error) => {
        toast.error(error?.response?.data?.error || 'Failed to save notification preferences');
      }).finally(() => setSavingPreferences(false));
      return next;
    });
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSession(sessionId);
      setSessions((current) => current.filter((session) => session._id !== sessionId));
      toast.success('Session revoked');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to revoke session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await revokeOtherSessions();
      setSessions((current) => current.filter((session) => session.isCurrent));
      toast.success('Other sessions revoked');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to revoke other sessions');
    }
  };

  const handleSetupMfa = async () => {
    try {
      const response = await setupMfa();
      setMfaSetup(response.data);
      setMfaCode('');
      toast.success('MFA setup started');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to start MFA setup');
    }
  };

  const handleVerifyMfa = async () => {
    try {
      const response = await verifyMfa(mfaCode);
      setRecoveryCodes(response.data?.recoveryCodes || []);
      setMfaSetup(null);
      setMfaCode('');
      await refreshSessionUser();
      toast.success('MFA enabled');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to verify MFA');
    }
  };

  const handleDisableMfa = async () => {
    try {
      await disableMfa(mfaDisablePassword, mfaCode);
      setMfaCode('');
      setMfaDisablePassword('');
      await refreshSessionUser();
      toast.success('MFA disabled');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to disable MFA');
    }
  };

  const handlePrivacyRequest = async (request) => {
    try {
      const response = request === 'export'
        ? await requestDataExport()
        : await requestAccountAction(request);
      setPrivacyRequests((current) => [response.data, ...current]);
      toast.success('Privacy request submitted');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to submit privacy request');
    }
  };

  const handleSaveGlobal = async (e) => {
    e.preventDefault();
    setSavingGlobal(true);
    try {
      await updateSettings(globalConfig);
      toast.success('Global settings updated');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update global settings');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-cyan-900 to-sky-900 p-6 md:p-8 text-white shadow-xl">
        <p className="text-cyan-100 text-xs uppercase tracking-[0.15em]">Workspace Settings</p>
        <h1 className="text-3xl font-bold mt-2">Settings</h1>
        <p className="text-cyan-50/90 mt-2 text-sm">Manage your profile, appearance, and day-to-day preferences from one place.</p>
      </div>

      <section id="profile" className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <h2 className="text-xl font-bold text-slate-900">Profile Update</h2>
        <p className="text-sm text-slate-600 mt-1">Keep your profile details current for leave processing and approvals.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            ['Employee ID', user?.employeeId || 'Not assigned'],
            ['Role', user?.role || 'Not assigned'],
            ['Department', user?.department?.name || 'Not assigned'],
            ['Status', user?.status || 'Unknown']
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 capitalize">{value}</p>
            </div>
          ))}
        </div>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5" onSubmit={handleSaveProfile}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Full Name</span>
            <input
              type="text"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Work Email</span>
            <input
              type="email"
              required
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Phone Number</span>
            <input
              type="text"
              value={profileForm.phoneNumber}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Designation</span>
            <input
              type="text"
              value={profileForm.designation}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, designation: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Alternate Email</span>
            <input
              type="email"
              value={profileForm.alternateEmail}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, alternateEmail: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Address - City</span>
            <input
              type="text"
              value={profileForm.address.city}
              onChange={(e) => updateAddressField('city', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Address - State</span>
            <input
              type="text"
              value={profileForm.address.state}
              onChange={(e) => updateAddressField('state', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Address - Country</span>
            <input
              type="text"
              value={profileForm.address.country}
              onChange={(e) => updateAddressField('country', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Emergency Contact Name</span>
            <input
              type="text"
              value={profileForm.emergencyContact.name}
              onChange={(e) => updateEmergencyField('name', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Emergency Contact Relationship</span>
            <input
              type="text"
              value={profileForm.emergencyContact.relationship}
              onChange={(e) => updateEmergencyField('relationship', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Emergency Contact Phone</span>
            <input
              type="text"
              value={profileForm.emergencyContact.phoneNumber}
              onChange={(e) => updateEmergencyField('phoneNumber', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-cyan-700 text-white text-sm font-semibold hover:bg-cyan-800 disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </section>

      {isAdmin && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
          <h2 className="text-xl font-bold text-slate-900">CEO Global Configuration</h2>
          <p className="text-sm text-slate-600 mt-1">Manage organization-wide policies and financial redistributions.</p>
          <form className="mt-5" onSubmit={handleSaveGlobal}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Leave Task Deduction Percentage (%)</span>
                <p className="text-xs text-slate-500 mb-1">Percentage of daily salary to deduct from a leaving employee to credit the covering employee.</p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={globalConfig.leaveTaskDeductionPercentage}
                  onChange={(e) => setGlobalConfig(prev => ({ ...prev, leaveTaskDeductionPercentage: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingGlobal}
                className="px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 disabled:opacity-60"
              >
                {savingGlobal ? 'Saving...' : 'Save Global Config'}
              </button>
            </div>
          </form>
        </section>
      )}

        <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
          <h2 className="text-xl font-bold text-slate-900">Privacy and Data</h2>
          <p className="text-sm text-slate-600 mt-1">Review your personal data and submit retention-aware account requests.</p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>Stored profile: {privacySummary?.profile?.email || user?.email || 'Loading...'}</p>
            <p className="mt-1 text-xs text-slate-500">Passwords, tokens, MFA secrets, and internal security records are excluded from exports.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => handlePrivacyRequest('export')} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
              Request data export
            </button>
            <button type="button" onClick={() => handlePrivacyRequest('deactivation')} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
              Request deactivation
            </button>
            <button type="button" onClick={() => handlePrivacyRequest('deletion')} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50">
              Request account deletion
            </button>
          </div>
          {privacyRequests.length > 0 && (
            <div className="mt-4 space-y-2">
              {privacyRequests.map((request) => (
                <div key={request._id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="capitalize text-slate-700">{request.type} request</span>
                  <span className="text-xs font-semibold capitalize text-slate-500">{request.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <h2 className="text-xl font-bold text-slate-900">Account Security</h2>
        <p className="text-sm text-slate-600 mt-1">Change credentials, review active sessions, and protect this account.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Current Password</span>
            <input
              type="password"
              value={profileForm.currentPassword}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="Required to change email or password"
            />
          </label>

          <div className="hidden md:block" />

          <label className="block">
            <span className="text-sm font-medium text-slate-700">New Password</span>
            <input
              type="password"
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="Leave blank to keep current password"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Confirm New Password</span>
            <input
              type="password"
              value={profileForm.confirmNewPassword}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="Repeat the new password"
            />
          </label>
        </div>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Active sessions</h3>
              <p className="text-xs text-slate-500 mt-1">Revoke sessions you no longer recognize.</p>
            </div>
            <button type="button" onClick={handleRevokeOtherSessions} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
              Logout other sessions
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {sessions.map((session) => (
              <div key={session._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{session.deviceName || 'Unknown device'}</p>
                  <p className="text-xs text-slate-500">{session.userAgent || 'Browser'} · {session.ipAddress || 'Unknown IP'}</p>
                </div>
                {session.isCurrent ? (
                  <span className="text-xs font-semibold text-emerald-700">Current</span>
                ) : (
                  <button type="button" onClick={() => handleRevokeSession(session._id)} className="text-xs font-semibold text-rose-700 hover:underline">Revoke</button>
                )}
              </div>
            ))}
            {!sessions.length && <p className="text-sm text-slate-500">No active sessions found.</p>}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Multi-factor authentication</h3>
              <p className="text-xs text-slate-500 mt-1">
                {user?.mfaEnabled ? 'MFA is enabled for this account.' : 'Protect sign-in with an authenticator app.'}
              </p>
            </div>
            {!user?.mfaEnabled && !mfaSetup && (
              <button type="button" onClick={handleSetupMfa} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800">
                Set up MFA
              </button>
            )}
          </div>

          {mfaSetup && (
            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm text-slate-700">Add this secret to your authenticator app:</p>
              <code className="mt-2 block break-all rounded bg-white p-2 text-sm">{mfaSetup.secret}</code>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Enter the 6-digit code
                <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <button type="button" onClick={handleVerifyMfa} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                Verify and enable
              </button>
            </div>
          )}

          {user?.mfaEnabled && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <label className="block text-sm font-medium text-slate-700">
                Current password
                <input type="password" value={mfaDisablePassword} onChange={(e) => setMfaDisablePassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Current MFA code
                <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <button type="button" onClick={handleDisableMfa} className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                Disable MFA
              </button>
            </div>
          )}

          {recoveryCodes.length > 0 && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Save these recovery codes. They are shown only once.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm text-emerald-900">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <h2 className="text-xl font-bold text-slate-900">Appearance</h2>
        <p className="text-sm text-slate-600 mt-1">Tune readability and motion according to your preference.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">Font Size</p>
            <select
              value={appearance.fontScale}
              onChange={(e) => setAppearance((prev) => ({ ...prev, fontScale: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">Reduced Motion</p>
            <p className="text-xs text-slate-500 mt-1">Turn off most UI animations and transitions.</p>
            <button
              type="button"
              onClick={() => setAppearance((prev) => ({ ...prev, reducedMotion: !prev.reducedMotion }))}
              className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${appearance.reducedMotion ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
            >
              {appearance.reducedMotion ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <h2 className="text-xl font-bold text-slate-900">Preferences</h2>
        <p className="text-sm text-slate-600 mt-1">Control reminders and personal productivity options.</p>

        <div className="space-y-3 mt-5">
          <button
            type="button"
            onClick={() => togglePreference('emailReminders')}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
          >
            <span className="text-sm text-slate-800">Email reminders for upcoming leave and approvals</span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${preferences.emailReminders ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {preferences.emailReminders ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => togglePreference('desktopAlerts')}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
          >
            <span className="text-sm text-slate-800">Desktop alerts for notifications</span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${preferences.desktopAlerts ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {preferences.desktopAlerts ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <h2 className="text-xl font-bold text-slate-900">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Role</p>
            <p className="font-semibold text-slate-900 capitalize">{user?.role || (isAdmin ? 'admin' : 'employee')}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Account Status</p>
            <p className="font-semibold text-slate-900 capitalize">{user?.status || 'active'}</p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
          >
            Logout from this session
          </button>
        </div>
      </section>
    </div>
  );
};

export default Settings;
