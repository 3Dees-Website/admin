import { createContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { userService } from '../services/userService';
import { categoryService } from '../services/categoryService';
import { notificationService } from '../services/notificationService';
import { TOKEN_STORAGE_KEYS } from '../services/apiClient';

const SESSION_MARKER_KEY = '3dees_session_active';   // sessionStorage, per-tab
const HEARTBEAT_KEY = '3dees_last_heartbeat';        // localStorage, shared across tabs
const HEARTBEAT_INTERVAL_MS = 5000;
// ~70s: safely above Chrome/Firefox's background-tab timer throttling floor
// (~60s), so a backgrounded-but-still-open tab isn't mistaken for a closed browser.
const HEARTBEAT_STALE_THRESHOLD_MS = 70000;

const SESSION_END_COPY = {
  manual: { type: 'info', title: 'Logged Out', message: 'You have been securely logged out.' },
  idle:   { type: 'info', title: 'Session Expired', message: 'Signed out due to inactivity.' },
};

const initialState = {
  currentUser: null,
  token: null,
  jobs: [],
  admins: [],
  categories: [],
  notifications: [],
  unreadCount: 0,
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
    case 'UPDATE_CURRENT_USER':
      return { ...state, currentUser: { ...state.currentUser, ...action.payload } };
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        jobs: action.payload.jobs ?? state.jobs,
        admins: action.payload.admins ?? state.admins,
        categories: action.payload.categories ?? state.categories,
        notifications: action.payload.notifications ?? state.notifications,
        unreadCount: action.payload.unreadCount ?? state.unreadCount,
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
    case 'ADD_ADMIN':
      return { ...state, admins: [...state.admins, action.payload] };
    case 'UPDATE_ADMIN':
      return {
        ...state,
        admins: state.admins.map((adm) => (adm.id === action.payload.id ? action.payload : adm)),
      };
    case 'DELETE_ADMIN':
      return { ...state, admins: state.admins.filter((adm) => adm.id !== action.payload) };
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };
    case 'DELETE_CATEGORY':
      return { ...state, categories: state.categories.filter((c) => c.id !== action.payload) };
    case 'MARK_NOTIFICATION_READ': {
      const target = state.notifications.find((n) => n.id === action.payload);
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
        unreadCount: target && !target.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    }
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
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
    // Categories are settled independently of jobs/admins: a categories
    // fetch failure should leave that list empty, not abort the rest of
    // the dashboard (and vice versa).
    const categoriesPromise = categoryService.getCategories().catch((err) => {
      handleApiError(err, 'Category Load Error', 'Could not load job categories from the server.');
      return [];
    });

    // Notifications fail silently (no toast): a bell that can't load shouldn't
    // interrupt the rest of the dashboard load with an error banner.
    const notificationsPromise = notificationService
      .getNotifications()
      .catch(() => ({ items: [], unreadCount: 0 }));

    try {
      const jobs = await jobService.getAdminJobs();

      let admins = [];
      // Only superadmins can fetch the users list
      if (user?.role === 'superadmin') {
        admins = await userService.getUsers();
      }

      const categories = await categoriesPromise;
      const notifData = await notificationsPromise;

      dispatch({
        type: 'SET_INITIAL_DATA',
        payload: { jobs, admins, categories, notifications: notifData.items, unreadCount: notifData.unreadCount },
      });
    } catch (err) {
      handleApiError(err, 'Data Load Error', 'Could not load portal data from the server.');
      const categories = await categoriesPromise;
      const notifData = await notificationsPromise;
      dispatch({
        type: 'SET_INITIAL_DATA',
        payload: { categories, notifications: notifData.items, unreadCount: notifData.unreadCount },
      });
    }
  }, [handleApiError]);

  // ── Session teardown (shared by manual logout, idle timeout, and the ─────
  // ── browser-reopen check below) ───────────────────────────────────────────

  const endSession = (reason) => {
    const refreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
    authService.logout(refreshToken); // fire-and-forget revocation
    localStorage.removeItem(TOKEN_STORAGE_KEYS.access);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.user);
    sessionStorage.removeItem(SESSION_MARKER_KEY);
    dispatch({ type: 'SET_AUTH', payload: null });
    dispatch({
      type: 'SET_INITIAL_DATA',
      payload: { jobs: [], admins: [], categories: [], notifications: [], unreadCount: 0 },
    });
    const copy = SESSION_END_COPY[reason];
    if (copy) addToast(copy.type, copy.title, copy.message);
  };

  // ── Session restoration on mount ─────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEYS.user);
    const accessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.access);

    if (raw && accessToken) {
      const tabMarker = sessionStorage.getItem(SESSION_MARKER_KEY);
      const lastHeartbeat = Number(localStorage.getItem(HEARTBEAT_KEY) || 0);
      const heartbeatFresh = Date.now() - lastHeartbeat < HEARTBEAT_STALE_THRESHOLD_MS;

      if (tabMarker || heartbeatFresh) {
        // Same tab reloaded (tabMarker survives reload), OR another tab of
        // this browser is currently alive (recent heartbeat) → rehydrate.
        sessionStorage.setItem(SESSION_MARKER_KEY, '1');
        const user = JSON.parse(raw);
        dispatch({ type: 'SET_AUTH', payload: { user, token: accessToken } });
        loadInitialData(user);
      } else {
        // No marker for this tab AND no other tab has been alive recently →
        // the browser was fully closed and reopened. Stored tokens are stale.
        endSession();
      }
    }

    // Start this tab's heartbeat regardless of the branch above, so any
    // future tab opened while this one is alive can detect it.
    localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
    const heartbeatId = setInterval(() => {
      localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeatId);
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
   * Requests a password reset email. The backend is enumeration-safe, so
   * every outcome except a rate limit returns the same generic confirmation.
   */
  const forgotPassword = async (email) => {
    const genericMessage = 'If that email is registered, a reset link has been sent. Check your inbox.';
    try {
      const data = await authService.requestPasswordReset(email);
      return { success: true, message: data?.message || genericMessage };
    } catch (err) {
      if (err?.error === 'TooManyRequests') {
        return {
          success: false,
          error: 'TooManyRequests',
          message: 'Too many attempts. Please wait a few minutes and try again.',
        };
      }
      return { success: true, message: genericMessage };
    }
  };

  /**
   * Submits a new password alongside the reset token from the emailed link.
   */
  const resetPassword = async ({ id, token, newPassword }) => {
    try {
      const data = await authService.resetPassword({ id, token, newPassword });
      return { success: true, message: data?.message || 'Your password has been reset.' };
    } catch (err) {
      const errorMap = {
        InvalidToken: 'This reset link is invalid or has expired.',
        TooManyRequests: 'Too many attempts. Please wait a few minutes and try again.',
      };
      const message =
        err?.error === 'ValidationError'
          ? err?.message || 'Password does not meet the required rules.'
          : errorMap[err?.error] || 'Something went wrong. Please try again.';
      return { success: false, error: err?.error, message };
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
    sessionStorage.setItem(SESSION_MARKER_KEY, '1');
    dispatch({ type: 'SET_AUTH', payload: { user, token: accessToken } });
    addToast('success', 'Session Opened', `Welcome back, ${user.name}.`);
    await loadInitialData(user);
  };

  /**
   * Merges a patch (e.g. a new name) into currentUser, both in React state
   * and in the persisted localStorage copy — ProtectedRoute and the
   * session-restore effect both read that copy directly, so a name change
   * that only updated state would revert on the next page refresh.
   */
  const updateCurrentUser = (patch) => {
    const updated = { ...state.currentUser, ...patch };
    localStorage.setItem(TOKEN_STORAGE_KEYS.user, JSON.stringify(updated));
    dispatch({ type: 'UPDATE_CURRENT_USER', payload: patch });
  };

  const logout = async () => endSession('manual');

  // Kept separate from logout() rather than an optional `reason` param on
  // logout itself: AdminLayout binds logout directly as onClick={logout},
  // and React would pass the click SyntheticEvent as that argument.
  const logoutIdle = () => endSession('idle');

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

  /**
   * Returns the updated application on success (or null on failure) so the
   * calling page can update its local view without a global applications
   * array. Callers are responsible for refetching their current page/stats
   * afterward.
   */
  const reviewApplication = async (appId, status, notes, egiNote) => {
    const adminUser = state.currentUser?.name || 'Admin';
    try {
      const updated = await applicationService.updateStatus(appId, {
        status,
        notes,
        egiNote,
        changedBy: adminUser,
      });
      addToast('info', 'Status Updated', `Applicant status set to ${status}.`);

      if (status === 'Approved') {
        addToast('success', 'Client Sync Initiated', 'Candidate synced to EGI portal by the server.');
      }

      return updated;
    } catch (err) {
      addToast('error', 'Status Update Failed', err?.message || 'Could not update application status.');
      return null;
    }
  };

  const updateApplication = async (appId, updates) => {
    try {
      const updated = await applicationService.updateApplication(appId, updates);
      return updated;
    } catch (err) {
      addToast('error', 'Update Failed', err?.message || 'Could not save candidate file.');
      return null;
    }
  };

  const uploadVerificationDocument = async (appId, formData) => {
    try {
      const updated = await applicationService.addVerificationDocument(appId, formData);
      addToast('success', 'Document Attached', 'Verification document uploaded.');
      return updated;
    } catch (err) {
      addToast('error', 'Upload Failed', err?.message || 'Could not attach the verification document.');
      return null;
    }
  };

  const deleteVerificationDocument = async (appId, docId) => {
    try {
      const updated = await applicationService.deleteVerificationDocument(appId, docId);
      addToast('info', 'Document Removed', 'Verification document deleted.');
      return updated;
    } catch (err) {
      addToast('error', 'Delete Failed', err?.message || 'Could not remove the verification document.');
      return null;
    }
  };

  const resendToEgi = async (appId, egiNote) => {
    try {
      const updated = await applicationService.resendToEgi(appId, egiNote);
      addToast('success', 'Resent to EGI', 'Candidate resubmitted to the EGI portal.');
      return updated;
    } catch (err) {
      addToast('error', 'Resend Failed', err?.message || 'Could not resend to the EGI portal.');
      return null;
    }
  };

  const getDocumentUrl = async (appId, key) => {
    try {
      return await applicationService.getDocumentUrl(appId, key);
    } catch (err) {
      addToast('error', 'Could Not Open Document', err?.message || 'This document could not be located.');
      return null;
    }
  };

  /**
   * Returns the backend's { success, failed } result (or null on failure) so
   * the calling page can decide how to refetch its current page/stats.
   */
  const bulkReviewApplications = async (appIds, status, egiNote) => {
    const adminUser = state.currentUser?.name || 'Admin';
    try {
      const result = await applicationService.bulkUpdateStatus({
        ids: appIds,
        status,
        egiNote,
        changedBy: adminUser,
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

      return result;
    } catch (err) {
      handleApiError(err, 'Bulk Update Failed', 'Could not complete bulk status update.');
      return null;
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

  // ── Category management (add: any admin; delete: superadmin only) ────────

  const addCategory = async (name) => {
    try {
      const newCategory = await categoryService.createCategory(name);
      dispatch({ type: 'ADD_CATEGORY', payload: newCategory });
      addToast('success', 'Category Added', `"${newCategory.name}" is now available.`);
      return { success: true, category: newCategory };
    } catch (err) {
      if (err?.error === 'DuplicateCategory') {
        return { success: false, error: 'DuplicateCategory', message: `"${name}" already exists.` };
      }
      handleApiError(err, 'Add Category Failed', 'Could not create category.');
      return { success: false, error: err?.error, message: err?.message };
    }
  };

  const removeCategory = async (id) => {
    const target = state.categories.find((c) => c.id === id);
    try {
      await categoryService.deleteCategory(id);
      dispatch({ type: 'DELETE_CATEGORY', payload: id });
      addToast('info', 'Category Deleted', `"${target?.name || 'Category'}" was removed.`);
    } catch (err) {
      handleApiError(err, 'Delete Failed', 'Could not delete category.');
    }
  };

  // ── Notifications ──────────────────────────────────────────────────────────

  // Used by both the initial load's independent settle and the bell's poll /
  // manual refetch. Silent on failure so a flaky poll tick every 60s doesn't
  // spam a toast.
  const refetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications();
      dispatch({
        type: 'SET_INITIAL_DATA',
        payload: { notifications: data.items, unreadCount: data.unreadCount },
      });
    } catch {
      // ignore
    }
  }, []);

  const markNotificationRead = async (id) => {
    try {
      await notificationService.markRead(id);
      dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
    } catch (err) {
      handleApiError(err, 'Update Failed', 'Could not mark notification as read.');
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await notificationService.markAllRead();
      dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    } catch (err) {
      handleApiError(err, 'Update Failed', 'Could not mark all notifications as read.');
    }
  };

  // ── Context value ─────────────────────────────────────────────────────────

  return (
    <PortalContext.Provider
      value={{
        ...state,
        login,
        forgotPassword,
        resetPassword,
        updateCurrentUser,
        commitSession,
        logout,
        logoutIdle,
        addToast,
        removeToast,
        postJob,
        editJob,
        removeJob,
        applyToJob,
        reviewApplication,
        updateApplication,
        uploadVerificationDocument,
        deleteVerificationDocument,
        resendToEgi,
        getDocumentUrl,
        bulkReviewApplications,
        registerAdmin,
        toggleAdminSuspension,
        resetAdminPass,
        removeAdmin,
        addCategory,
        removeCategory,
        refetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}
