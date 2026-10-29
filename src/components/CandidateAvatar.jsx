import { useState, useRef, useEffect } from 'react';
import './styles/CandidateAvatar.css';

const initialsOf = (name) => (name || '?').trim().slice(0, 2).toUpperCase() || '?';

/**
 * A fixed-size circle with the applicant's initials always rendered, and their
 * passport photo layered on top once it has loaded. A missing URL (no photo for
 * that job, or the server couldn't sign it) or any load failure leaves the
 * initials showing, so the circle never changes size or shows a broken image.
 *
 * `className` supplies the page's own size and colours for the circle (the
 * pending pages' apa-avatar / spa-avatar); without one a default is used.
 * `size` (CSS length) overrides the circle's size inline.
 *
 * `onRefreshUrl` (optional) is an async () => string | null, called at most once
 * if the photo fails to load (a URL that expired while the tab sat open). A
 * different URL back is tried; anything else leaves the initials.
 *
 * The inner component is keyed by `photoUrl`, so a new URL (e.g. after a
 * refetch) starts over, including the one refresh attempt.
 */
export function CandidateAvatar({ photoUrl, ...rest }) {
  return <Avatar key={photoUrl || ''} photoUrl={photoUrl} {...rest} />;
}

function Avatar({ name, photoUrl, onRefreshUrl, size, className = '' }) {
  const [src, setSrc] = useState(photoUrl || null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'failed'
  const refreshTried = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleError = async () => {
    if (!onRefreshUrl || refreshTried.current) {
      setStatus('failed');
      return;
    }
    refreshTried.current = true;
    let fresh = null;
    try {
      fresh = await onRefreshUrl();
    } catch {
      // fall through to initials
    }
    if (!mounted.current) return;
    if (fresh && fresh !== src) {
      setSrc(fresh);
      setStatus('loading');
    } else {
      setStatus('failed');
    }
  };

  const style = size ? { width: size, height: size } : undefined;
  return (
    <div className={`cav ${className || 'cav--default'}`} style={style} data-photo-status={src ? status : 'none'}>
      <span className="cav-initials" aria-hidden="true">{initialsOf(name)}</span>
      {src && status !== 'failed' && (
        <img
          key={src}
          className={`cav-img${status === 'loaded' ? ' cav-img--loaded' : ''}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={handleError}
        />
      )}
    </div>
  );
}
