import { createContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { userService } from '../services/userService';
import { auditService } from '../services/auditService';
import { TOKEN_STORAGE_KEYS } from '../services/apiClient';

const initialState = {
  currentUser: null,
  token: null,
  jobs: [],
  applications: [],
  admins: [],
  auditLogs: [],
  toasts: [],
};

function portalReducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return {
        ...state,
        currentUser: action.payload ? action.payload.user : null,
        token: action.payload ? action.payload.token : null,
      };
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        jobs: action.payload.jobs ?? state.jobs,
        applications: action.payload.applications ?? state.applications,
        admins: action.payload.admins ?? state.admins,
        auditLogs: action.payload.auditLogs ?? state.auditLogs,
      };
    case 'ADD_JOB':
      return { ...state, jobs: [...state.jobs, action.payload] };
    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === action.payload.id ? action.payload : j)),
      };
    case 'DELETE_JOB':
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.payload) };
    case 'ADD_APPLICATION':
      return { ...state, applications: [...state.applications, action.payload] };
    case 'UPDATE_APPLICATION_STATUS':
      return {
        ...state,
        applications: state.applications.map((app) =>
          app.id === action.payload.id ? action.payload : app
        ),
      };
    case 'BULK_UPDATE_APPLICATIONS': {
      const { updatedApps } = action.payload;
      const updatedMap = new Map(updatedApps.map((a) => [a.id, a]));
      return {
        ...state,
        applications: state.applications.map((app) => updatedMap.get(app.id) || app),
      };
    }
    case 'ADD_ADMIN':
      return { ...state, admins: [...state.admins, action.payload] };
    case 'UPDATE_ADMIN':
      return {
        ...state,
        admins: state.admins.map((adm) => (adm.id === action.payload.id ? action.payload : adm)),
      };
    case 'DELETE_ADMIN':
      return { ...state, admins: state.admins.filter((adm) => adm.id !== action.payload) };
    case 'SET_AUDIT_LOGS':
      return { ...state, auditLogs: action.payload };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    default:
      return state;
  }
}

export const PortalContext = createContext(undefined);

export function PortalProvider({ children }) {
  const [state, dispatch] = useReducer(portalReducer, initialState);

  // ── Toast helpers ─────────────────────────────────────────────────────────

  const addToast = useCallback((type, title, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    dispatch({ type: 'ADD_TOAST', payload: { id, type, title, message } });
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'DISMISS_TOAST', payload: id });
  }, []);

  // ── API error helper ──────────────────────────────────────────────────────

  const handleApiError = useCallback((err, fallbackTitle, fallbackMsg) => {
    const message = err?.message || fallbackMsg || 'An unexpected error occurred.';
    addToast('error', fallbackTitle, message);
  }, [addToast]);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadInitialData = useCallback(async (user) => {
    try {
      const [jobs, applications, auditLogs] = await Promise.all([
        jobService.getAdminJobs(),
        applicationService.getApplications(),
        auditService.getAuditLogs(),
      ]);

      let admins = [];
      // Only superadmins can fetch the users list
      if (user?.role === 'superadmin') {
        admins = await userService.getUsers();
      }

      dispatch({
        type: 'SET_INITIAL_DATA',
        payload: { jobs, applications, admins, auditLogs },
      });
    } catch (err) {
      handleApiError(err, 'Data Load Error', 'Could not load portal data from the server.');
    }
  }, [handleApiError]);

  const refreshAuditLogs = useCallback(async () => {
    try {
      const logs = await auditService.getAuditLogs();
      dispatch({ type: 'SET_AUDIT_LOGS', payload: logs });
    } catch {
      // Silent — audit logs are secondary
    }
  }, []);

  // ── Session restoration on mount ─────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEYS.user);
    const accessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.access);

    if (raw && accessToken) {
      const user = JSON.parse(raw);
      dispatch({ type: 'SET_AUTH', payload: { user, token: accessToken } });
      loadInitialData(user);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Authentication ────────────────────────────────────────────────────────

  /**
   * Step 1 — Validates credentials and triggers the OTP email.
   * Returns { pendingToken, destination } on success, null on failure.
   * The caller (AdminLogin) navigates to the OTP page with this data.
   */
  const login = async (email, password) => {
    try {
      const data = await authService.login(email, password);
      return data; // { pendingToken, destination }
    } catch (err) {
      const errorMap = {
        InvalidCredentials: 'Invalid email address or security passcode.',
        Suspended: 'This account has been suspended. Contact the system administrator.',
        TooManyRequests: 'Too many login attempts. Please wait 15 minutes before trying again.',
        ValidationError: 'Please provide a valid email address and password.',
      };
      const message = errorMap[err?.error] || err?.message || 'Authentication failed.';
      addToast('error', 'Authentication Failed', message);
      return null;
    }
  };

  /**
   * Step 2 — Called by OTPVerification after the backend confirms the OTP.
   * Persists the session and loads all portal data.
   */
  const commitSession = async (user, accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_STORAGE_KEYS.access, accessToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.refresh, refreshToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.user, JSON.stringify(user));
    dispatch({ type: 'SET_AUTH', payload: { user, token: accessToken } });
    addToast('success', 'Session Opened', `Welcome back, ${user.name}.`);
    await loadInitialData(user);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
    authService.logout(refreshToken); // fire-and-forget revocation
    localStorage.removeItem(TOKEN_STORAGE_KEYS.access);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.user);
    dispatch({ type: 'SET_AUTH', payload: null });
    dispatch({ type: 'SET_INITIAL_DATA', payload: { jobs: [], applications: [], admins: [], auditLogs: [] } });
    addToast('info', 'Logged Out', 'You have been securely logged out.');
  };

  // ── Job management ────────────────────────────────────────────────────────

  const postJob = async (jobData) => {
    try {
      const payload = {
        ...jobData,
        postedBy: state.currentUser?.name || 'System Admin',
      };
      const newJob = await jobService.createJob(payload);
      dispatch({ type: 'ADD_JOB', payload: newJob });
      addToast('success', 'Job Posted', `"${newJob.title}" has been successfully published.`);
      return newJob;
    } catch (err) {
      handleApiError(err, 'Job Post Failed', 'Could not create the job posting.');
      return null;
    }
  };

  const editJob = async (updatedJobData) => {
    try {
      const updated = await jobService.updateJob(updatedJobData.id, updatedJobData);
      dispatch({ type: 'UPDATE_JOB', payload: updated });
      addToast('success', 'Job Updated', `Changes to "${updated.title}" saved.`);
      return updated;
    } catch (err) {
      handleApiError(err, 'Job Update Failed', 'Could not save job changes.');
      return null;
    }
  };

  const removeJob = async (jobId) => {
    const targetJob = state.jobs.find((j) => j.id === jobId);
    try {
      await jobService.deleteJob(jobId);
      dispatch({ type: 'DELETE_JOB', payload: jobId });
      addToast('info', 'Job Deleted', `"${targetJob?.title || 'Job'}" was removed.`);
    } catch (err) {
      const message =
        err?.error === 'HasApplications'
          ? 'This job cannot be deleted because it has associated applications.'
          : err?.message || 'Could not delete job.';
      addToast('error', 'Delete Failed', message);
    }
  };

  // ── Application management ────────────────────────────────────────────────

  /**
   * Public-facing submission. Used if this admin app also hosts a public
   * application form. Pass a pre-built FormData object.
   */
  const applyToJob = async (formData) => {
    try {
      const result = await applicationService.submitApplication(formData);
      addToast(
        'success',
        'Application Submitted',
        `Application received. Reference: ${result.referenceId}`
      );
      return result.referenceId;
    } catch (err) {
      const errorMap = {
        JobClosed: 'This job is no longer accepting applications.',
        DeadlinePassed: 'The application deadline for this job has passed.',
        MissingDocument: 'A required document was not uploaded.',
      };
      const message = errorMap[err?.error] || err?.message || 'Could not submit application.';
      addToast('error', 'Submission Failed', message);
      return null;
    }
  };

  const reviewApplication = async (appId, status, notes, egiNote) => {
    const app = state.applications.find((a) => a.id === appId);
    if (!app) return;

    const adminUser = state.currentUser?.name || 'Admin';
    try {
      const updated = await applicationService.updateStatus(appId, {
        status,
        notes,
        egiNote,
        changedBy: adminUser,
      });
      dispatch({ type: 'UPDATE_APPLICATION_STATUS', payload: updated });
      addToast('info', 'Status Updated', `Applicant status set to ${status}.`);

      if (status === 'Approved') {
        addToast('success', 'Client Sync Initiated', 'Candidate synced to EGI portal by the server.');
      }

      await refreshAuditLogs();
    } catch (err) {
      const message =
        err?.error === 'InvalidTransition'
          ? `Cannot change status from ${app.status} to ${status}.`
          : err?.message || 'Could not update application status.';
      addToast('error', 'Status Update Failed', message);
    }
  };

  const updateApplication = async (appId, updates) => {
    try {
      const updated = await applicationService.updateApplication(appId, updates);
      dispatch({ type: 'UPDATE_APPLICATION_STATUS', payload: updated });
      return updated;
    } catch (err) {
      addToast('error', 'Update Failed', err?.message || 'Could not save candidate file.');
      return null;
    }
  };

  const bulkReviewApplications = async (appIds, status, egiNote) => {
    const adminUser = state.currentUser?.name || 'Admin';
    try {
      const result = await applicationService.bulkUpdateStatus({
        ids: appIds,
        status,
        egiNote,
        changedBy: adminUser,
      });

      // Re-fetch applications to get the authoritative updated state from the server
      const freshApplications = await applicationService.getApplications();
      dispatch({
        type: 'SET_INITIAL_DATA',
        payload: { applications: freshApplications },
      });

      const successCount = result.success?.length ?? appIds.length;
      const failCount = result.failed?.length ?? 0;

      if (failCount > 0) {
        addToast(
          'warning',
          'Partial Bulk Update',
          `${successCount} updated; ${failCount} could not transition to ${status}.`
        );
      } else {
        addToast(
          'success',
          'Bulk Action Complete',
          `Successfully marked ${successCount} applicant${successCount !== 1 ? 's' : ''} as ${status}.`
        );
      }

      await refreshAuditLogs();
    } catch (err) {
      handleApiError(err, 'Bulk Update Failed', 'Could not complete bulk status update.');
    }
  };

  // ── Admin user management (superadmin only) ───────────────────────────────

  const registerAdmin = async (name, email, password) => {
    try {
      const newAdmin = await userService.createUser({ name, email, password, role: 'admin' });
      dispatch({ type: 'ADD_ADMIN', payload: newAdmin });
      addToast('success', 'Admin Account Created', `Representative ${name} has been added.`);
      return true;
    } catch (err) {
      const message =
        err?.error === 'DuplicateEmail'
          ? `The email ${email} is already registered.`
          : err?.message || 'Could not create admin account.';
      addToast('error', 'Registration Error', message);
      return false;
    }
  };

  const toggleAdminSuspension = async (adminId) => {
    try {
      const updated = await userService.toggleStatus(adminId);
      dispatch({ type: 'UPDATE_ADMIN', payload: updated });
      addToast('info', 'Status Changed', `${updated.name}'s account is now ${updated.status}.`);
    } catch (err) {
      handleApiError(err, 'Status Change Failed', 'Could not update user status.');
    }
  };

  const resetAdminPass = async (adminId, newPassword) => {
    try {
      await userService.resetPassword(adminId, newPassword);
      addToast('success', 'Password Updated', 'The representative\'s credential has been reassigned.');
    } catch (err) {
      handleApiError(err, 'Password Reset Failed', 'Could not reset the password.');
    }
  };

  const removeAdmin = async (adminId) => {
    const targetAdmin = state.admins.find((a) => a.id === adminId);
    try {
      await userService.deleteUser(adminId);
      dispatch({ type: 'DELETE_ADMIN', payload: adminId });
      addToast('info', 'Admin Deleted', `Advisory account for ${targetAdmin?.name || 'Admin'} was deleted.`);
    } catch (err) {
      handleApiError(err, 'Delete Failed', 'Could not delete admin account.');
    }
  };

  // ── Context value ─────────────────────────────────────────────────────────

  return (
    <PortalContext.Provider
      value={{
        ...state,
        login,
        commitSession,
        logout,
        addToast,
        removeToast,
        postJob,
        editJob,
        removeJob,
        applyToJob,
        reviewApplication,
        updateApplication,
        bulkReviewApplications,
        registerAdmin,
        toggleAdminSuspension,
        resetAdminPass,
        removeAdmin,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}
