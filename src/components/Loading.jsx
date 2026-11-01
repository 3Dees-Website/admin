import { motion, useReducedMotion } from 'motion/react';
import { useLoadingGate } from '../hooks/useLoadingGate';
import './styles/Loading.css';

/**
 * A breathing circle for loading states. Renders nothing until `delay` ms of
 * loading have passed, then stays for at least `minDuration` ms. With
 * `reserveSpace` it keeps an empty box of the same size while hidden, so
 * surrounding content doesn't shift when the circle appears.
 *
 * The root is a span so it can sit inside a <p>, a table cell or a flex row.
 * The circle takes `color`; the caption keeps whatever colour its parent has.
 * Never use this to drive a button's label or disabled state: pass the real
 * flag to those and only the circle through here.
 */
export function Loading({
  isLoading,
  size = 'lg',
  color = 'var(--color-brand-primary)',
  label = 'Loading',
  showLabel = false,
  reserveSpace = false,
  delay = 150,
  minDuration = 350,
  className = '',
}) {
  const { visible } = useLoadingGate(isLoading, { delay, minDuration });
  const reduceMotion = useReducedMotion();

  if (!visible) {
    if (!reserveSpace) return null;
    return (
      <span className={`ld ld--${size} ${className}`.trim()} aria-hidden="true">
        <span className="ld-dot ld-dot--reserved" />
      </span>
    );
  }

  const from = reduceMotion ? { opacity: 0.5 } : { scale: 0.75, opacity: 0.5 };
  const to = reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 };

  return (
    <span
      className={`ld ld--${size}${showLabel ? ' ld--labelled' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <motion.span
        className="ld-dot"
        style={{ color }}
        initial={from}
        animate={to}
        transition={{ duration: 0.7, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        aria-hidden="true"
      />
      {showLabel ? <span className="ld-label">{label}</span> : <span className="ld-sr">{label}</span>}
    </span>
  );
}
