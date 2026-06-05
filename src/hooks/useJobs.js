import { useContext } from 'react';
import { PortalContext } from '../context/PortalContext';

export function useJobs() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('useJobs must be used inside a PortalProvider');
  }
  return {
    jobs: context.jobs,
    postJob: context.postJob,
    editJob: context.editJob,
    removeJob: context.removeJob,
  };
}