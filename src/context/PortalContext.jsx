import { createContext, useReducer, useEffect } from 'react';
import { localStorageDb, sendToEGIPortal } from '../services/localStorageDb';

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
        jobs: action.payload.jobs,
        applications: action.payload.applications,
        admins: action.payload.admins,
        auditLogs: action.payload.auditLogs,
      };
    case 'ADD_JOB':
      return { ...state, jobs: [...state.jobs, action.payload] };
    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: state.jobs.map((job) => (job.id === action.payload.id ? action.payload : job)),
      };
    case 'DELETE_JOB':
      return {
        ...state,
        jobs: state.jobs.filter((job) => job.id !== action.payload),
      };
    case 'ADD_APPLICATION':
      return { ...state, applications: [...state.applications, action.payload] };
    case 'UPDATE_APPLICATION_STATUS':
      return {
        ...state,
        applications: state.applications.map((app) =>
          app.id === action.payload.appId
            ? {
                ...app,
                status: action.payload.status,
                egiSyncStatus: action.payload.egiSyncStatus,
                statusHistory: action.payload.history,
                notes: action.payload.notes !== undefined ? action.payload.notes : app.notes,
              }
            : app
        ),
      };
    case 'BULK_UPDATE_APPLICATIONS':
      return {
        ...state,
        applications: state.applications.map((app) =>
          action.payload.ids.includes(app.id)
            ? {
                ...app,
                status: action.payload.status,
                statusHistory: action.payload.historyUpdates[app.id] || app.statusHistory,
              }
            : app
        ),
      };
    case 'ADD_ADMIN':
      return { ...state, admins: [...state.admins, action.payload] };
    case 'UPDATE_ADMIN_STATUS':
      return {
        ...state,
        admins: state.admins.map((adm) =>
          adm.id === action.payload.adminId ? { ...adm, status: action.payload.status } : adm
        ),
      };
    case 'RESET_ADMIN_PASSWORD':
      return {
        ...state,
        admins: state.admins.map((adm) =>
          adm.id === action.payload.adminId ? { ...adm, passwordHash: action.payload.passwordHash } : adm
        ),
      };
    case 'DELETE_ADMIN':
      return {
        ...state,
        admins: state.admins.filter((adm) => adm.id !== action.payload),
      };
    case 'RELOAD_AUDIT_LOGS':
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

  // Load initial data from localStorage
  useEffect(() => {
    const persistedUser = localStorage.getItem('3dees_current_user');
    const persistedToken = localStorage.getItem('3dees_token');
    if (persistedUser && persistedToken) {
      dispatch({
        type: 'SET_AUTH',
        payload: { user: JSON.parse(persistedUser), token: persistedToken },
      });
    }

    const jobs = localStorageDb.getJobs();
    const applications = localStorageDb.getApplications();
    const users = localStorageDb.getUsers().filter((u) => u.role === 'admin');
    const auditLogs = localStorageDb.getAuditLogs();

    dispatch({
      type: 'SET_INITIAL_DATA',
      payload: { jobs, applications, admins: users, auditLogs },
    });
  }, []);

  const refreshLogsAndUsers = () => {
    const freshLogs = localStorageDb.getAuditLogs();
    const freshAdmins = localStorageDb.getUsers().filter((u) => u.role === 'admin');
    dispatch({ type: 'RELOAD_AUDIT_LOGS', payload: freshLogs });
    dispatch({
      type: 'SET_INITIAL_DATA',
      payload: {
        jobs: localStorageDb.getJobs(),
        applications: localStorageDb.getApplications(),
        admins: freshAdmins,
        auditLogs: freshLogs,
      },
    });
  };

  const addToast = (type, title, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    dispatch({ type: 'ADD_TOAST', payload: { id, type, title, message } });
  };

  const removeToast = (id) => {
    dispatch({ type: 'DISMISS_TOAST', payload: id });
  };

  const login = async (email, passwordHash) => {
    try {
      const loginPayload = localStorageDb.loginUser(email, passwordHash);
      if (loginPayload) {
        localStorage.setItem('3dees_current_user', JSON.stringify(loginPayload.user));
        localStorage.setItem('3dees_token', loginPayload.token);
        dispatch({ type: 'SET_AUTH', payload: loginPayload });
        addToast('success', 'Logged In Successfully', `Welcome back, ${loginPayload.user.name}`);
        refreshLogsAndUsers();
        return true;
      } else {
        addToast('error', 'Authentication Failed', 'Invalid credentials specified.');
        return false;
      }
    } catch (err) {
      addToast('error', 'Authentication Error', err.message || 'Suspended or invalid account.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('3dees_current_user');
    localStorage.removeItem('3dees_token');
    dispatch({ type: 'SET_AUTH', payload: null });
    addToast('info', 'Logged Out', 'You have been securely logged out.');
  };

  const postJob = (jobData) => {
    const newJob = {
      ...jobData,
      id: 'job-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      postedBy: state.currentUser ? state.currentUser.name : 'System Admin',
    };
    const updatedJobs = [...state.jobs, newJob];
    localStorageDb.saveJobs(updatedJobs);
    dispatch({ type: 'ADD_JOB', payload: newJob });
    addToast('success', 'Job Posted', `"${newJob.title}" has been successfully published.`);
    refreshLogsAndUsers();
  };

  const editJob = (updatedJob) => {
    const updatedJobs = state.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j));
    localStorageDb.saveJobs(updatedJobs);
    dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
    addToast('success', 'Job Updated', `Changes to "${updatedJob.title}" saved.`);
    refreshLogsAndUsers();
  };

  const removeJob = (jobId) => {
    const targetJob = state.jobs.find((j) => j.id === jobId);
    const updatedJobs = state.jobs.filter((j) => j.id !== jobId);
    localStorageDb.saveJobs(updatedJobs);
    dispatch({ type: 'DELETE_JOB', payload: jobId });
    addToast('info', 'Job Deleted', `"${targetJob?.title || 'Job'}" was removed.`);
    refreshLogsAndUsers();
  };

  const applyToJob = (appData) => {
    const referenceId = `3DEES-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const newApp = {
      ...appData,
      id: 'app-' + Math.random().toString(36).substring(2, 9),
      referenceId,
      status: 'Pending',
      egiSyncStatus: 'Pending',
      statusHistory: [{ status: 'Pending', changedBy: 'Self-Service Applicant', timestamp: new Date().toISOString() }],
      submittedAt: new Date().toISOString(),
    };
    const updatedApps = [...state.applications, newApp];
    localStorageDb.saveApplications(updatedApps);
    dispatch({ type: 'ADD_APPLICATION', payload: newApp });

    const targetJob = state.jobs.find((j) => j.id === appData.jobId);
    localStorageDb.addAuditEntry(
      newApp.id,
      newApp.personalInfo.fullName,
      targetJob?.title || 'Unknown Role',
      'New',
      'Pending',
      'Self-Service Portal'
    );

    addToast('success', 'Application Submitted', `Application successfully received. Ref: ${referenceId}`);
    refreshLogsAndUsers();
    return referenceId;
  };

  const reviewApplication = async (appId, status, notes) => {
    const app = state.applications.find((a) => a.id === appId);
    if (!app) return;

    const previousStatus = app.status;
    const adminUser = state.currentUser ? state.currentUser.name : 'Unknown Admin';
    const timestamp = new Date().toISOString();

    const updatedHistory = [
      ...app.statusHistory,
      { status, changedBy: adminUser, timestamp },
    ];

    let finalSyncStatus = app.egiSyncStatus;
    const targetJob = state.jobs.find((j) => j.id === app.jobId);
    const roleTitle = targetJob ? targetJob.title : 'Undefined Job';

    if (status === 'Approved') {
      finalSyncStatus = 'Synced';
      try {
        await sendToEGIPortal({ ...app, status, statusHistory: updatedHistory, notes }, roleTitle);
        addToast('success', 'Client Sync Successful', 'Candidate synced to client portal (EGI).');
      } catch (err) {
        addToast('error', 'Sync Failed', 'Could not transmit status update to client portal.');
        finalSyncStatus = 'Pending';
      }
    }

    const updatedApps = state.applications.map((a) =>
      a.id === appId
        ? { ...a, status, statusHistory: updatedHistory, egiSyncStatus: finalSyncStatus, notes: notes !== undefined ? notes : a.notes }
        : a
    );
    localStorageDb.saveApplications(updatedApps);
    localStorageDb.addAuditEntry(appId, app.personalInfo.fullName, roleTitle, previousStatus, status, adminUser);

    dispatch({
      type: 'UPDATE_APPLICATION_STATUS',
      payload: { appId, status, egiSyncStatus: finalSyncStatus, history: updatedHistory, notes },
    });

    addToast('info', 'Status Updated', `Applicant status set to ${status}.`);
    refreshLogsAndUsers();
  };

  const bulkReviewApplications = (appIds, status) => {
    const adminUser = state.currentUser ? state.currentUser.name : 'Unknown Admin';
    const timestamp = new Date().toISOString();
    const historyUpdates = {};

    const updatedApps = state.applications.map((app) => {
      if (appIds.includes(app.id)) {
        const updatedHist = [...app.statusHistory, { status, changedBy: adminUser, timestamp }];
        historyUpdates[app.id] = updatedHist;

        const targetJob = state.jobs.find((j) => j.id === app.jobId);
        localStorageDb.addAuditEntry(
          app.id,
          app.personalInfo.fullName,
          targetJob?.title || 'Unknown Role',
          app.status,
          status,
          adminUser
        );

        return { ...app, status, statusHistory: updatedHist };
      }
      return app;
    });

    localStorageDb.saveApplications(updatedApps);
    dispatch({ type: 'BULK_UPDATE_APPLICATIONS', payload: { ids: appIds, status, historyUpdates } });
    addToast('success', 'Bulk Action Complete', `Successfully bulk-marked ${appIds.length} applicants as ${status}.`);
    refreshLogsAndUsers();
  };

  const registerAdmin = (name, email, passwordHash) => {
    const allUsers = localStorageDb.getUsers();
    if (allUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      addToast('error', 'Registration Error', `Admin email ${email} is already in use.`);
      return false;
    }

    const newAdmin = {
      id: 'u-' + Math.random().toString(36).substring(2, 9),
      name,
      email,
      passwordHash,
      role: 'admin',
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    allUsers.push(newAdmin);
    localStorageDb.saveUsers(allUsers);
    dispatch({ type: 'ADD_ADMIN', payload: newAdmin });
    addToast('success', 'Admin Account Created', `Representative ${name} has been added.`);
    refreshLogsAndUsers();
    return true;
  };

  const toggleAdminSuspension = (adminId) => {
    const allUsers = localStorageDb.getUsers();
    const targetUser = allUsers.find((u) => u.id === adminId);
    if (!targetUser) return;

    const newStatus = targetUser.status === 'Active' ? 'Suspended' : 'Active';
    targetUser.status = newStatus;
    localStorageDb.saveUsers(allUsers);

    dispatch({ type: 'UPDATE_ADMIN_STATUS', payload: { adminId, status: newStatus } });
    addToast('info', 'Status Changed', `${targetUser.name}'s account is now ${newStatus}.`);
    refreshLogsAndUsers();
  };

  const resetAdminPass = (adminId, newPass) => {
    const allUsers = localStorageDb.getUsers();
    const targetUser = allUsers.find((u) => u.id === adminId);
    if (!targetUser) return;

    targetUser.passwordHash = newPass;
    localStorageDb.saveUsers(allUsers);

    dispatch({ type: 'RESET_ADMIN_PASSWORD', payload: { adminId, passwordHash: newPass } });
    addToast('success', 'Password Updated', `Representative ${targetUser.name}'s credential has been reassigned.`);
    refreshLogsAndUsers();
  };

  const removeAdmin = (adminId) => {
    const allUsers = localStorageDb.getUsers();
    const targetUser = allUsers.find((u) => u.id === adminId);
    const filteredUsers = allUsers.filter((u) => u.id !== adminId);
    localStorageDb.saveUsers(filteredUsers);

    dispatch({ type: 'DELETE_ADMIN', payload: adminId });
    addToast('info', 'Admin Deleted', `Advisory account for ${targetUser?.name || 'Admin'} was deleted.`);
    refreshLogsAndUsers();
  };

  return (
    <PortalContext.Provider
      value={{
        ...state,
        login,
        logout,
        addToast,
        removeToast,
        postJob,
        editJob,
        removeJob,
        applyToJob,
        reviewApplication,
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