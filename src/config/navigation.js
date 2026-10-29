import {
  LayoutDashboard, Briefcase, FileUser, Users,
  History, Inbox, RefreshCw, UserCircle, UserCheck, UserCog, ClipboardCheck, ListChecks,
} from 'lucide-react';
import { can, PERM } from '../utils/permissions';
import { routeBaseFor } from '../utils/routeBase';

/**
 * The sidebar, from one table. Each entry is a route segment that exists under
 * both /admin and /superadmin or under one of them (see App.jsx).
 *
 *   labels     the name shown per tree
 *   permission when set, a plain admin sees the entry only while holding it
 *              (a superadmin always does, as can() says)
 *
 * NAV_ORDER is what each tree shows and in what order.
 */
const NAV_ITEMS = {
  dashboard:          { icon: LayoutDashboard, labels: { admin: 'Console Home', superadmin: 'Dashboard' } },
  pending:            { icon: Inbox,           labels: { admin: 'Pending Queue', superadmin: 'Pending Queue' } },
  applications:       { icon: FileUser,        labels: { admin: 'Applications', superadmin: 'All Applications' } },
  scoring:            { icon: ClipboardCheck,  labels: { admin: 'Scoring', superadmin: 'Scoring' } },
  screened:           { icon: ListChecks,      labels: { admin: 'Screened', superadmin: 'Screened' } },
  approved:           { icon: UserCheck,       labels: { admin: 'Approved Candidates', superadmin: 'Approved Candidates' }, permission: PERM.VIEW_APPROVED_CANDIDATES },
  jobs:               { icon: Briefcase,       labels: { admin: 'Manage Jobs', superadmin: 'Manage Jobs' } },
  admins:             { icon: Users,           labels: { superadmin: 'Manage Admins' } },
  audit:              { icon: History,         labels: { superadmin: 'Compliance Audits' } },
  'account-activity': { icon: UserCog,         labels: { superadmin: 'Account Activity' } },
  'egi-sync':         { icon: RefreshCw,       labels: { admin: 'EGI Sync', superadmin: 'EGI Sync' }, permission: PERM.EGI_SYNC_ACCESS },
  profile:            { icon: UserCircle,      labels: { admin: 'Profile', superadmin: 'Profile' } },
};

const NAV_ORDER = {
  admin: ['dashboard', 'jobs', 'pending', 'applications', 'scoring', 'screened', 'approved', 'egi-sync', 'profile'],
  superadmin: [
    'dashboard', 'pending', 'applications', 'scoring', 'screened', 'approved', 'jobs',
    'admins', 'audit', 'account-activity', 'egi-sync', 'profile',
  ],
};

/** The menu for `tree` ('admin' | 'superadmin'): [{ name, path, Icon }]. */
export function buildMenu(tree, user) {
  const base = routeBaseFor({ role: tree });
  return NAV_ORDER[tree]
    .map((segment) => ({ segment, ...NAV_ITEMS[segment] }))
    .filter((item) => !item.permission || can(user, item.permission))
    .map((item) => ({ name: item.labels[tree], path: `${base}/${item.segment}`, Icon: item.icon }));
}
