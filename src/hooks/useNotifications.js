import { useContext } from 'react';
import { PortalContext } from '../context/PortalContext';

export function useNotifications() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('useNotifications must be used inside a PortalProvider');
  }
  return {
    notifications: context.notifications,
    unreadCount: context.unreadCount,
    notificationsStatus: context.notificationsStatus,
    markRead: context.markNotificationRead,
    markAllRead: context.markAllNotificationsRead,
    refetch: context.refetchNotifications,
  };
}
