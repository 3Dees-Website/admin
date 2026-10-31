import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, AlertCircle, FlipHorizontal, Loader2, X } from 'lucide-react';
import { validateFile } from '../utils/enrollmentValidation';
import './styles/CameraCapture.css';

// Passport-style portrait crop. The stage in CameraCapture.css is 3:4 and the
// video uses object-fit: cover, so cropping the frame to the same ratio makes
// the saved photo match what the applicant saw.
const STAGE_RATIO = 3 / 4;
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.9;

const UPLOAD_INSTEAD = 'upload a photo file instead';

const ERRORS = {
  denied: {
    title: 'Camera access is blocked',
    body: 'Your browser isn’t allowing this site to use the camera. Click the camera or lock icon in your address bar, set Camera to “Allow”, then press Try Again.',
    canRetry: true,
  },
  noDevice: {
    title: 'No camera found',
    body: `We couldn’t find a camera on this device. Connect a camera and press Try Again, or ${UPLOAD_INSTEAD}.`,
    canRetry: true,
  },
  inUse: {
    title: 'Camera is unavailable',
    body: `Another app or browser tab may be using your camera. Close it and press Try Again, or ${UPLOAD_INSTEAD}.`,
    canRetry: true,
  },
  unsupported: {
    title: 'Camera not supported',
    body: `This browser can’t open the camera from this page. Try the latest Chrome, Safari, Firefox or Edge, or ${UPLOAD_INSTEAD}.`,
    canRetry: false,
  },
  unknown: {
    title: 'Couldn’t start the camera',
    body: `Something went wrong while starting the camera. Press Try Again or ${UPLOAD_INSTEAD}.`,
    canRetry: true,
  },
};

const classifyError = (err) => {
  switch (err?.name) {
    case 'Unsupported': return ERRORS.unsupported;
    case 'NotAllowedError':
    case 'SecurityError': return ERRORS.denied;
    case 'NotFoundError':
    case 'OverconstrainedError': return ERRORS.noDevice;
    case 'NotReadableError':
    case 'AbortError': return ERRORS.inUse;
    default: return ERRORS.unknown;
  }
};

// `exact` is used only when the applicant flips cameras, so a device without
// the requested lens fails fast (and we fall back) instead of silently
// handing back the same camera.
const openStream = async (facing, exact) => {
  const facingMode = exact ? { exact: facing } : { ideal: facing };
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
  } catch (err) {
    // Only the "ideal" request is retried unconstrained; an "exact" failure
    // must surface so the flip handler can restore the previous camera.
    if (!exact && err?.name === 'OverconstrainedError') {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw err;
  }
};

const canvasToFile = (canvas, mimeTypes) =>
  new Promise((resolve) => {
    const type = mimeTypes?.includes('image/jpeg') || !mimeTypes?.includes('image/png')
      ? 'image/jpeg'
      : 'image/png';
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      const finalType = blob.type || type;
      const ext = finalType === 'image/png' ? 'png' : 'jpg';
      resolve(new File([blob], `passport-photo.${ext}`, { type: finalType, lastModified: Date.now() }));
    }, type, JPEG_QUALITY);
  });

function CameraCapture({ field, onCapture, onClose }) {
  const [phase, setPhase] = useState('requesting'); // requesting | live | review | error
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [facing, setFacing] = useState('user');
  const [everLive, setEverLive] = useState(false);
  const [photo, setPhoto] = useState(null); // { file, url }

  const videoRef = useRef(null);
  const panelRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(0); // bumped on every stop/start so late getUserMedia results can be discarded
  const phaseRef = useRef(phase);
  const facingRef = useRef(facing);
  const resumeRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
    facingRef.current = facing;
  });

  const stopStream = useCallback(() => {
    requestRef.current += 1;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const showError = useCallback((err) => {
    setError(classifyError(err));
    setPhase('error');
  }, []);

  // Resolves { stream } | { err } | { stale }.
  const acquire = useCallback(async (facingMode, exact) => {
    stopStream();
    const id = requestRef.current;
    if (!navigator.mediaDevices?.getUserMedia) return { err: { name: 'Unsupported' } };
    try {
      const stream = await openStream(facingMode, exact);
      if (id !== requestRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return { stale: true };
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          if (streamRef.current !== stream) return;
          stopStream();
          showError({ name: 'NotFoundError' });
        };
        setFacing(track.getSettings?.().facingMode === 'environment' ? 'environment' : 'user');
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.play?.().catch(() => {});
      }
      return { stream };
    } catch (err) {
      return id === requestRef.current ? { err } : { stale: true };
    }
  }, [stopStream, showError]);

  const settle = useCallback((result) => {
    if (!result.stale && result.err) showError(result.err);
  }, [showError]);

  // Used by Retake, Try Again and tab-return; the initial request is the mount effect below.
  const begin = useCallback(async (facingMode) => {
    setPhase('requesting');
    setNotice(null);
    settle(await acquire(facingMode, false));
  }, [acquire, settle]);

  useEffect(() => {
    // State is only set after the awaited getUserMedia call resolves, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    acquire('user', false).then(settle);
    return stopStream;
  }, [acquire, settle, stopStream]);

  // Release the camera while the tab is hidden; take it back when it returns.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (phaseRef.current === 'live' || phaseRef.current === 'requesting') {
          resumeRef.current = true;
          stopStream();
          setPhase('requesting');
        }
      } else if (resumeRef.current) {
        resumeRef.current = false;
        begin(facingRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [begin, stopStream]);

  // Lock page scroll and move focus into the dialog while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const url = photo?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photo]);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = panelRef.current?.querySelectorAll('button:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setNotice(null);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let sw;
    let sh;
    if (vw / vh > STAGE_RATIO) {
      sh = vh;
      sw = vh * STAGE_RATIO;
    } else {
      sw = vw;
      sh = vw / STAGE_RATIO;
    }
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    // Drawn straight from the video, so the saved photo is never mirrored.
    canvas.getContext('2d').drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);

    const file = await canvasToFile(canvas, field.validation?.mimeTypes);
    if (!file) {
      setNotice('Couldn’t capture the photo. Please try again.');
      return;
    }
    stopStream(); // camera light off while the applicant reviews the shot
    setPhoto({ file, url: URL.createObjectURL(file) });
    setPhase('review');
  };

  const handleRetake = () => {
    setPhoto(null);
    begin(facing);
  };

  const handleUse = () => {
    const invalid = validateFile(field, photo.file);
    if (invalid) {
      // Inline, not a toast: toasts render underneath this overlay.
      setNotice(invalid);
      return;
    }
    stopStream();
    onCapture(photo.file);
    onClose();
  };

  const handleFlip = async () => {
    const previous = facing;
    const next = previous === 'user' ? 'environment' : 'user';
    setPhase('requesting');
    setNotice(null);

    let result = await acquire(next, true);
    if (result.stale) return;
    if (result.err) {
      // Flip failures never dead-end the applicant: go back to the camera that worked.
      result = await acquire(previous, false);
      if (result.stale) return;
      if (result.err) {
        showError(result.err);
        return;
      }
      setNotice('Couldn’t switch cameras. This device may only have one.');
    }
  };

  const mirrored = facing !== 'environment';
  const titleId = `camera-title-${field.key}`;

  return (
    <motion.div
      className="cc-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <motion.div
        ref={panelRef}
        className="cc-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="cc-header">
          <h2 className="cc-title" id={titleId}>Take Passport Photo</h2>
          <button type="button" className="cc-close" onClick={handleClose} aria-label="Close camera">
            <X size={18} />
          </button>
        </div>

        <div className="cc-stage">
          <video
            ref={videoRef}
            className={`cc-video ${mirrored ? 'cc-video-mirror' : ''} ${phase === 'live' ? '' : 'cc-video-hidden'}`}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              setEverLive(true);
              setPhase((p) => (p === 'requesting' ? 'live' : p));
            }}
          />
          {phase === 'live' && <div className="cc-guide" aria-hidden="true" />}
          {phase === 'requesting' && (
            <div className="cc-status" role="status">
              <Loader2 className="cc-spinner" size={24} />
              <span>Starting camera…</span>
              {!everLive && <span className="cc-status-hint">Choose &ldquo;Allow&rdquo; when your browser asks for camera access.</span>}
            </div>
          )}
          {phase === 'review' && photo && (
            <img className="cc-photo" src={photo.url} alt="Preview of your captured passport photo" />
          )}
          {phase === 'error' && error && (
            <div className="cc-error" role="alert">
              <AlertCircle size={28} className="cc-error-icon" />
              <strong className="cc-error-title">{error.title}</strong>
              <p className="cc-error-body">{error.body}</p>
            </div>
          )}
        </div>

        {phase === 'live' && !notice && (
          <p className="cc-hint">Face the camera in good light, with a plain background behind you.</p>
        )}
        {notice && <p className="cc-notice" role="alert">{notice}</p>}

        <div className={`cc-footer cc-footer-${phase}`}>
          {(phase === 'requesting' || phase === 'live') && (
            <button type="button" className="cc-btn cc-btn-secondary cc-cancel" onClick={handleClose}>
              Cancel
            </button>
          )}
          {phase === 'live' && (
            <>
              <button type="button" className="cc-btn cc-btn-primary cc-capture" onClick={handleCapture}>
                <Camera size={16} /> Capture
              </button>
              <button type="button" className="cc-flip" onClick={handleFlip} aria-label="Switch between front and back camera">
                <FlipHorizontal size={20} />
              </button>
            </>
          )}
          {phase === 'review' && (
            <>
              <button type="button" className="cc-btn cc-btn-secondary" onClick={handleRetake}>Retake</button>
              <button type="button" className="cc-btn cc-btn-primary" onClick={handleUse}>Use This Photo</button>
            </>
          )}
          {phase === 'error' && (
            <>
              {error?.canRetry && (
                <button type="button" className="cc-btn cc-btn-primary" onClick={() => begin(facing)}>Try Again</button>
              )}
              <button type="button" className="cc-btn cc-btn-secondary" onClick={handleClose}>Upload a File Instead</button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * "Take Photo" trigger plus its overlay. Owns the open state so FieldRenderer's
 * switch statement doesn't need a conditional hook. The overlay is portalled to
 * <body> because Apply's animated ancestors have transforms, which would trap a
 * position: fixed overlay inside them.
 */
export function PhotoCaptureControl({ field, onCapture }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button type="button" ref={triggerRef} className="cc-trigger" onClick={() => setOpen(true)}>
        <Camera className="cc-trigger-icon" />
        <span>Take Photo</span>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && <CameraCapture key="camera" field={field} onCapture={onCapture} onClose={handleClose} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
