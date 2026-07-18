import { useContext } from 'react';
import { PortalContext } from '../context/PortalContext';

export function useApplications() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('useApplications must be used inside a PortalProvider');
  }
  return {
    applyToJob: context.applyToJob,
    reviewApplication: context.reviewApplication,
    updateApplication: context.updateApplication,
    uploadVerificationDocument: context.uploadVerificationDocument,
    deleteVerificationDocument: context.deleteVerificationDocument,
    resendToEgi: context.resendToEgi,
    bulkReviewApplications: context.bulkReviewApplications,
  };
}