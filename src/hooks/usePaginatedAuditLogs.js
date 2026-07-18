import { auditService } from '../services/auditService';
import { createPaginatedListHook } from './createPaginatedListHook';

export const usePaginatedAuditLogs = createPaginatedListHook(
  auditService.getAuditLogsPage
);
