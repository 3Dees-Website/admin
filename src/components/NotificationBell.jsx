import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, FileUser, Check, RefreshCw, AlertTriangle, UserPlus, UserX,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import './styles/NotificationBell.css';

const POLL_INTERVAL_MS = 60000;

const TYPE_META = {
  new_application: { icon: FileUser, tone: 'blue' },
  status_change: { icon: Check, tone: 'green' },
  egi_decision: { icon: RefreshCw, tone: 'blue' },
  egi_sync_failed: { icon: AlertTriangle, tone: 'red' },
  admin_created: { icon: UserPlus, tone: 'green' },
  admin_suspended: { icon: UserX, tone: 'red' },
};
const DEFAULT_TYPE_META = { icon: Bell, tone: 'gray' };

export function NotificationBell({ role }) {
  const { notifications, unreadCount, markRead, markAllRead, refetch } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleNotificationClick = (notif) => {
    if (!notif.read) markRead(notif.id);
    setOpen(false);

    if (notif.application_id) {
      navigate(`/${role}/applications?openApp=${notif.application_id}`);
    } else if (role === 'superadmin') {
      navigate('/superadmin/admins');
    } else {
      navigate(`/${role}/dashboard`);
    }
  };

  return (
    <div className="notif-bell-wrap" ref={wrapperRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-panel-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-list">
            {notifications.length === 0 && (
              <div className="notif-panel-empty">
                <Bell size={22} />
                <span>No notifications yet</span>
              </div>
            )}
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] || DEFAULT_TYPE_META;
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <span className={`notif-item-icon notif-item-icon--${meta.tone}`}>
                    <Icon size={14} />
                  </span>
                  <span className="notif-item-body">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-message">{n.message}</span>
                    <span className="notif-item-time">{formatRelativeTime(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="notif-item-dot" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
