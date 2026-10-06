import { accountAuditService } from '../services/accountAuditService';
import { createPaginatedListHook } from './createPaginatedListHook';

export const usePaginatedAccountAuditLogs = createPaginatedListHook(
  accountAuditService.getAccountAuditLogsPage
);
