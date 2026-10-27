import { applicationService } from '../services/applicationService';
import { createPaginatedListHook } from './createPaginatedListHook';

export const usePaginatedScreened = createPaginatedListHook(applicationService.getScreenedPage);
