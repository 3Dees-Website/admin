export const effectiveStatus = (job) => (job.isExpired ? 'Expired' : job.status || 'Active');
