import { applicationService } from '../services/applicationService';
import { createPaginatedListHook } from './createPaginatedListHook';

export const usePaginatedApplications = createPaginatedListHook(
  applicationService.getApplicationsPage
);
