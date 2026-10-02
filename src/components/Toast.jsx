import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useToast } from '../hooks/useToast';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import './styles/Toast.css';

// Warnings and errors carry the messages an admin most needs to read in
// full (e.g. a partial bulk failure listing reasons), so they stay longer.
const TOAST_DURATION_MS = { warning: 8000, error: 8000 };
const DEFAULT_TOAST_DURATION_MS = 4000;

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  const durationMs = TOAST_DURATION_MS[toast.type] ?? DEFAULT_TOAST_DURATION_MS;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [onClose, durationMs]);

  const styleMap = {
    success: {
      borderClass: 'toast--success',
      icon: <CheckCircle size={20} className="toast-icon toast-icon--success" />,
    },
    error: {
      borderClass: 'toast--error',
      icon: <AlertCircle size={20} className="toast-icon toast-icon--error" />,
    },
    warning: {
      borderClass: 'toast--warning',
      icon: <AlertTriangle size={20} className="toast-icon toast-icon--warning" />,
    },
    info: {
      borderClass: 'toast--info',
      icon: <Info size={20} className="toast-icon toast-icon--info" />,
    },
  };

  const current = styleMap[toast.type] || styleMap.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      className={`toast-item ${current.borderClass}`}
      id={`toast-${toast.id}`}
    >
      <div className="toast-icon-wrap">{current.icon}</div>
      <div className="toast-body">
        <h4 className="toast-title">{toast.title}</h4>
        <p className="toast-message">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="toast-close"
        id={`btn-close-toast-${toast.id}`}
        aria-label="Close"
      >
        <X size={16} />
      </button>

      {/* Progress bar */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: durationMs / 1000, ease: 'linear' }}
        className="toast-progress"
      />
    </motion.div>
  );
}