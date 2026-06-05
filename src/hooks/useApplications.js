import { useContext } from 'react';
import { PortalContext } from '../context/PortalContext';

export function useApplications() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('useApplications must be used inside a PortalProvider');
  }
  return {
    applications: context.applications,
    auditLogs: context.auditLogs,
    applyToJob: context.applyToJob,
    reviewApplication: context.reviewApplication,
    bulkReviewApplications: context.bulkReviewApplications,
  };
}