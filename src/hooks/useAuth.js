import { useContext } from 'react';
import { PortalContext } from '../context/PortalContext';

export function useAuth() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('useAuth must be used inside a PortalProvider');
  }
  return {
    currentUser: context.currentUser,
    token: context.token,
    login: context.login,
    logout: context.logout,
    admins: context.admins,
    registerAdmin: context.registerAdmin,
    toggleAdminSuspension: context.toggleAdminSuspension,
    resetAdminPass: context.resetAdminPass,
    removeAdmin: context.removeAdmin,
  };
}