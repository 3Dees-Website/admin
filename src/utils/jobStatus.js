export const effectiveStatus = (job, submissionCount) => {
  if (job.isExpired) return 'Expired';
  if (submissionCount != null && submissionCount >= job.openings) return 'Closed';
  return job.status || 'Active';
};
