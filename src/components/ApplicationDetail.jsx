import { useState, useMemo, useEffect } from 'react';
import { Eye, Trash2, Edit2, Save, X as XIcon, Send, ShieldAlert } from 'lucide-react';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { useApplications } from '../hooks/useApplications';
import { applicationService } from '../services/applicationService';
import { FieldRenderer } from './FieldRenderer';
import { EgiNoteModal } from './EgiNoteModal';
import { AdminNotesPanel } from './AdminNotesPanel';
import { EgiSyncBadge, EgiDeliveryBadge, EgiDecisionBadge, EgiResendBadge } from './EgiBadges';
import { groupFieldsBySection, getSubfieldsForParent } from '../utils/fieldCatalogHelpers';
import { getLockInfo } from '../utils/applicationLock';
import { VERIFICATION_DOC_TYPES } from '../utils/verificationDocTypes';
import './styles/ApplicationDetail.css';

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : null);

/**
 * One line saying what is actually happening with the latest delivery, and
 * whether EGI has the application. `alert` marks the state no one will fix
 * automatically.
 */
function describeDelivery(delivery) {
  const { deliveryState, attempts, maxAttempts, nextAttemptAt, updatedAt } = delivery;
  switch (deliveryState) {
    case 'pending':
      return { text: 'Queued for delivery to EGI. EGI has not received it yet.' };
    case 'sending':
      return { text: `Delivery in progress (attempt ${attempts + 1} of ${maxAttempts}).` };
    case 'stuck':
      return { text: 'The last send was interrupted. It will be retried automatically. EGI has not confirmed receipt.' };
    case 'retrying':
      return {
        text: `Attempt ${attempts} of ${maxAttempts} failed.${nextAttemptAt ? ` Next attempt ${formatWhen(nextAttemptAt)}.` : ''} EGI has not received this application yet.`,
      };
    case 'exhausted':
      return { text: `Delivery failed after ${maxAttempts} attempts. EGI has not received this application.`, alert: true };
    case 'synced':
      return { text: `Received by EGI${updatedAt ? ` on ${formatWhen(updatedAt)}` : ''}.` };
    default:
      return null;
  }
}

const renderFieldValue = (field, value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'declaration') return value ? 'Yes' : 'No';
  return String(value);
};

/**
 * The single ~90-field application renderer, shared by CandidateEditDrawer
 * and the two bespoke drawers (AdminApplications, SuperadminViewAllApplications)
 * so the field-catalog-driven view/edit/documents/verification/resend logic
 * exists exactly once. Status transitions (Reject/Shortlist/Approve) stay
 * owned by the caller's own footer — this component only handles content:
 * viewing, editing form_data, applicant documents, verification documents,
 * and EGI resend.
 */
export function ApplicationDetail({ app, currentUser, notesDraft, onAppUpdated, onDeleted, onDeleteFailed }) {
  const { catalog, isLoading } = useFieldCatalog();
  const { updateApplication, uploadVerificationDocument, deleteVerificationDocument, resendToEgi, deleteApplication } = useApplications();

  const [isEditing, setIsEditing] = useState(false);
  const [editedFormData, setEditedFormData] = useState(app.formData);
  const [saving, setSaving] = useState(false);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delivery truth (egi_delivery / egi_can_resend / egi_resend_kind) only comes
  // from GET /applications/:id, and most callers open this drawer with a list
  // row. So it is fetched here, keyed on the fields that change it: a result
  // for a stale key counts as "not loaded" and is refetched.
  const [egiInfoTick, setEgiInfoTick] = useState(0);
  const [egiInfo, setEgiInfo] = useState(null);
  const egiInfoKey = `${app.id}|${app.egiSyncStatus}|${app.egiDecision}|${app.egiResendCount}|${egiInfoTick}`;

  useEffect(() => {
    setEditedFormData(app.formData);
    setIsEditing(false);
  }, [app.id]);

  useEffect(() => {
    let cancelled = false;
    applicationService.getApplication(app.id)
      .then((fresh) => {
        if (cancelled) return;
        // List rows can be up to a poll old; the fresh notes become
        // previousNotes (while the draft is untouched) so a stale row
        // can't cause a false conflict.
        notesDraft?.adoptServerNotes(fresh.id, fresh.notes);
        setEgiInfo({
          key: egiInfoKey,
          failed: false,
          delivery: fresh.egiDelivery ?? null,
          canResend: Boolean(fresh.egiCanResend),
          resendKind: fresh.egiResendKind ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setEgiInfo({ key: egiInfoKey, failed: true, error: err });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egiInfoKey]);

  const egiLoaded = egiInfo?.key === egiInfoKey;
  const egiDelivery = egiLoaded && !egiInfo.failed ? egiInfo.delivery : undefined;

  const lockInfo = useMemo(() => getLockInfo(app, currentUser, egiDelivery), [app, currentUser, egiDelivery]);

  // The server decides whether a resend is allowed and which kind. If that
  // lookup failed, fall back to the old Declined-only rule rather than hide
  // Resend entirely; the server still enforces the real rules on submit.
  const egiFallback = egiLoaded && egiInfo.failed;
  const canResend = egiLoaded && (egiFallback ? Boolean(lockInfo.canResend) : egiInfo.canResend);
  const resendKind = egiFallback ? (lockInfo.canResend ? 'resubmission' : null) : egiInfo?.resendKind;
  const isRedelivery = canResend && resendKind === 'redelivery';

  useEffect(() => {
    if (egiFallback) {
      console.warn(
        `[ApplicationDetail] Could not load EGI delivery info for application ${app.id}; `
        + `Resend visibility is using the Declined-only fallback rule (shown: ${Boolean(lockInfo.canResend)}).`,
        egiInfo.error,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egiFallback, app.id]);

  const canDelete =
    currentUser?.role === 'superadmin' &&
    app.status === 'Rejected' &&
    app.egiSyncStatus === 'Pending' &&
    app.egiDecision === 'Pending';

  const sectionGroups = useMemo(
    () => (catalog ? groupFieldsBySection(catalog.sections, catalog.fields) : []),
    [catalog]
  );

  if (isLoading || !catalog) {
    return <div className="ad-loading">Loading application…</div>;
  }

  const formSource = isEditing ? editedFormData : app.formData;

  const handleFieldChange = (key, value) => {
    setEditedFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartEdit = () => {
    setEditedFormData(app.formData);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedFormData(app.formData);
    setIsEditing(false);
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    const updated = await updateApplication(app.id, { formData: editedFormData });
    setSaving(false);
    if (updated) {
      setIsEditing(false);
      onAppUpdated?.(updated);
    }
  };

  const handleUploadVerificationDoc = async (file, docType, label) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    if (label) formData.append('label', label);
    const updated = await uploadVerificationDocument(app.id, formData);
    if (updated) onAppUpdated?.(updated);
  };

  const handleDeleteVerificationDoc = async (docId) => {
    const updated = await deleteVerificationDocument(app.id, docId);
    if (updated) onAppUpdated?.(updated);
  };

  const handleResendConfirm = async (egiNote) => {
    setResendBusy(true);
    const updated = await resendToEgi(app.id, egiNote);
    if (updated) {
      setResendBusy(false);
      setResendModalOpen(false);
      onAppUpdated?.(updated);
      setEgiInfoTick((t) => t + 1);
      return;
    }

    // The failure (e.g. 409 Conflict: the application changed underneath) has
    // already been toasted with the server's message. Reload so the drawer
    // shows the current state; keep the modal and its typed note open only if
    // a resend is still allowed.
    try {
      const fresh = await applicationService.getApplication(app.id);
      onAppUpdated?.(fresh);
      setEgiInfoTick((t) => t + 1);
      if (!fresh.egiCanResend) setResendModalOpen(false);
    } catch {
      // Best-effort refresh; the modal stays open for another attempt.
    } finally {
      setResendBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    const success = await deleteApplication(app.id);
    setDeleting(false);
    setDeleteConfirmOpen(false);

    if (success) {
      onDeleted?.();
      return;
    }

    onDeleteFailed?.();
    try {
      const fresh = await applicationService.getApplication(app.id);
      onAppUpdated?.(fresh);
    } catch {
      // Best-effort refresh; if this also fails the drawer keeps showing
      // the pre-attempt data until the user manually refreshes.
    }
  };

  return (
    <div className="ad-wrapper">
      {lockInfo.banner && (
        <div className={`ad-lock-banner ad-lock-banner--${lockInfo.tone}`}>{lockInfo.banner}</div>
      )}

      <nav className="ad-nav">
        {sectionGroups.map(({ section, fields }) => {
          const hasAny = section.key === 'documents'
            || fields.some((f) => formSource[f.key] !== undefined && formSource[f.key] !== '');
          if (!hasAny) return null;
          return (
            <a key={section.key} href={`#ad-section-${section.key}`} className="ad-nav-pill">
              {section.title}
            </a>
          );
        })}
        <a href="#ad-section-verification" className="ad-nav-pill">Verification</a>
      </nav>

      <div className="ad-egi-panel">
        <div className="ad-egi-row">
          <span>Delivery to EGI</span>
          {egiDelivery
            ? <EgiDeliveryBadge state={egiDelivery.deliveryState} />
            : <EgiSyncBadge status={app.egiSyncStatus} />}
        </div>
        {egiDelivery && <DeliveryDetail delivery={egiDelivery} />}
        <div className="ad-egi-row">
          <span>EGI Decision</span>
          <div className="ad-egi-row-right">
            <EgiDecisionBadge decision={app.egiDecision} />
            <EgiResendBadge count={app.egiResendCount} />
          </div>
        </div>
        {app.egiNote && (
          <div className="ad-egi-note"><strong>Note sent to EGI:</strong><p>{app.egiNote}</p></div>
        )}
        {app.egiDecision === 'Declined' && app.egiDecisionNote && (
          <div className="ad-egi-note ad-egi-note--declined"><strong>EGI's decline reason:</strong><p>{app.egiDecisionNote}</p></div>
        )}
        {app.egiDecisionBy && (
          <span className="ad-egi-meta">
            Decided by {app.egiDecisionBy}{app.egiDecisionAt && ` on ${new Date(app.egiDecisionAt).toLocaleDateString()}`}
          </span>
        )}
        {app.egiReferenceId && <span className="ad-egi-meta">EGI reference: {app.egiReferenceId}</span>}

        {canResend && (
          <button type="button" className="ad-resend-btn" onClick={() => setResendModalOpen(true)}>
            <Send size={14} /> {isRedelivery ? 'Redeliver to EGI' : 'Resend to EGI'}
          </button>
        )}
      </div>

      {!lockInfo.locked && (
        <div className="ad-edit-toolbar">
          {!isEditing ? (
            <button type="button" className="ad-edit-btn" onClick={handleStartEdit}>
              <Edit2 size={14} /> Edit Application
            </button>
          ) : (
            <div className="ad-edit-actions">
              <button type="button" className="ad-cancel-edit-btn" onClick={handleCancelEdit} disabled={saving}>
                <XIcon size={14} /> Cancel
              </button>
              <button type="button" className="ad-save-edit-btn" onClick={handleSaveEdits} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {sectionGroups.map(({ section, fields }) => {
        if (section.key === 'documents') {
          return (
            <section key={section.key} id="ad-section-documents" className="ad-section">
              <h3 className="ad-section-title">{section.title}</h3>
              <DocumentsPanel fields={fields} documents={app.documents} appId={app.id} />
            </section>
          );
        }

        const visibleFields = fields.filter(
          (f) => f.type !== 'file' && formSource[f.key] !== undefined && formSource[f.key] !== ''
        );
        if (visibleFields.length === 0) return null;

        return (
          <section key={section.key} id={`ad-section-${section.key}`} className="ad-section">
            <h3 className="ad-section-title">{section.title}</h3>
            <div className="ad-field-grid">
              {visibleFields.map((field) => {
                const subfields = getSubfieldsForParent(catalog.fields, field.key);
                const showSubfields = subfields.length > 0 && formSource[field.key] === 'Yes';
                return (
                  <div key={field.key} className="ad-field-block">
                    <div className="ad-field-row">
                      <span className="ad-field-label">{field.label}</span>
                      {isEditing ? (
                        <FieldRenderer
                          field={field}
                          value={editedFormData[field.key]}
                          onChange={(v) => handleFieldChange(field.key, v)}
                          allValues={editedFormData}
                          lgasByState={catalog.lgasByState}
                        />
                      ) : (
                        <span className="ad-field-value">{renderFieldValue(field, formSource[field.key])}</span>
                      )}
                    </div>

                    {showSubfields && (
                      <div className="ad-subfields">
                        {subfields.map((sub) => {
                          if (sub.type === 'file') {
                            const doc = app.documents[sub.key];
                            return (
                              <div key={sub.key} className="ad-field-row ad-field-row--sub">
                                <span className="ad-field-label">{sub.label}</span>
                                {doc ? (
                                  <ViewDocumentButton appId={app.id} docKey={doc.key} iconSize={12}>
                                    {doc.name}
                                  </ViewDocumentButton>
                                ) : (
                                  <span className="ad-field-value">Not provided</span>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div key={sub.key} className="ad-field-row ad-field-row--sub">
                              <span className="ad-field-label">{sub.label}</span>
                              {isEditing ? (
                                <FieldRenderer
                                  field={sub}
                                  value={editedFormData[sub.key]}
                                  onChange={(v) => handleFieldChange(sub.key, v)}
                                  allValues={editedFormData}
                                  lgasByState={catalog.lgasByState}
                                />
                              ) : (
                                <span className="ad-field-value">{renderFieldValue(sub, formSource[sub.key])}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section id="ad-section-verification" className="ad-section">
        <h3 className="ad-section-title">Verification Documents — Uploaded by 3DEES</h3>
        <VerificationDocumentsPanel
          appId={app.id}
          verificationDocuments={app.verificationDocuments}
          locked={lockInfo.locked}
          onUpload={handleUploadVerificationDoc}
          onDelete={handleDeleteVerificationDoc}
        />
      </section>

      <AdminNotesPanel notesDraft={notesDraft} />

      <section className="ad-section">
        <h3 className="ad-section-title">Evaluation Audit Trace</h3>
        <div className="ad-history-list">
          {(app.statusHistory || []).map((h, i) => (
            <div key={i} className="ad-history-item">
              <span>
                Set to <strong className="ad-history-status">{h.status}</strong> by{' '}
                <span className="ad-history-by">{h.changedBy}</span>
              </span>
              <span className="ad-history-time">
                {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {(!app.statusHistory || app.statusHistory.length === 0) && (
            <span className="ad-empty-hint">No status history recorded yet.</span>
          )}
        </div>
      </section>

      {canDelete && (
        <section className="ad-section ad-danger-zone">
          <h3 className="ad-section-title">Danger Zone</h3>
          <button type="button" className="ad-delete-btn" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 size={14} /> Delete Application
          </button>
        </section>
      )}

      {isRedelivery ? (
        <EgiNoteModal
          open={resendModalOpen}
          busy={resendBusy}
          title="Redeliver to EGI"
          confirmLabel="Redeliver"
          description={`Delivery of ${app.applicantName}'s application failed after ${egiDelivery?.maxAttempts ?? 'several'} attempts, so EGI never received it. This sends it again as a new delivery. The approval stays as it is, and there is no EGI decision to reset.`}
          noteRequired={false}
          placeholder="Leave blank to send the original note."
          hint="If you leave this blank, EGI receives the same note as the failed delivery. If you write one, it replaces that note, both in what EGI receives and on this record."
          onCancel={() => setResendModalOpen(false)}
          onConfirm={handleResendConfirm}
        />
      ) : (
        <EgiNoteModal
          open={resendModalOpen}
          busy={resendBusy}
          title="Resend to EGI"
          confirmLabel="Resend & Sync"
          description={`Resending ${app.applicantName} sends a new note to EGI and resets the decision to pending.`}
          onCancel={() => setResendModalOpen(false)}
          onConfirm={handleResendConfirm}
        />
      )}

      {deleteConfirmOpen && (
        <div className="ad-delete-overlay">
          <div className="ad-delete-backdrop" onClick={deleting ? undefined : () => setDeleteConfirmOpen(false)} />
          <div className="ad-delete-modal">
            <ShieldAlert className="ad-delete-icon" />
            <h3 className="ad-delete-title">Delete Application</h3>
            <p className="ad-delete-desc">
              This permanently deletes <strong>{app.applicantName}</strong>&apos;s application, all uploaded
              documents, and verification records. This cannot be undone.
            </p>
            <div className="ad-delete-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="ad-delete-cancel-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="ad-delete-confirm-btn"
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared "view document" button — fetches a fresh signed URL on click ── */
function ViewDocumentButton({ appId, docKey, iconSize = 14, className = 'ad-doc-view-btn', children }) {
  const { getDocumentUrl } = useApplications();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    // Open the tab synchronously, inside the click gesture, so browsers
    // don't treat the later redirect (after the awaited fetch) as a blocked popup.
    const tab = window.open('about:blank', '_blank');
    setLoading(true);
    setError('');
    const url = await getDocumentUrl(appId, docKey);
    setLoading(false);

    if (!tab) {
      setError('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    if (url) {
      tab.location.href = url;
    } else {
      tab.close();
      setError('Could not open this document.');
    }
  };

  return (
    <span className="ad-doc-view-wrap">
      <button type="button" className={className} onClick={handleClick} disabled={loading}>
        <Eye size={iconSize} /> {loading ? 'Opening…' : children}
      </button>
      {error && <span className="ad-doc-error">{error}</span>}
    </span>
  );
}

/* ── Applicant documents (view-only) ────────────────────────────────────── */
function DocumentsPanel({ fields, documents, appId }) {
  const rows = fields.flatMap((field) => {
    const val = documents[field.key];
    if (!val) return [];
    if (field.multiple && Array.isArray(val)) {
      return val.map((item, i) => ({ field, item, key: `${field.key}-${i}` }));
    }
    return [{ field, item: val, key: field.key }];
  });

  if (rows.length === 0) {
    return <p className="ad-empty-hint">No documents were uploaded with this application.</p>;
  }

  return (
    <div className="ad-doc-grid">
      {rows.map(({ field, item, key }) => (
        <div key={key} className="ad-doc-card">
          <div className="ad-doc-card-info">
            <span className="ad-doc-card-label">{field.label}</span>
            <span className="ad-doc-card-name">{item.name}</span>
          </div>
          <ViewDocumentButton appId={appId} docKey={item.key}>View</ViewDocumentButton>
        </div>
      ))}
    </div>
  );
}

/* ── Verification documents (admin-uploaded, with upload/delete) ─────────── */
function DeliveryDetail({ delivery }) {
  const line = describeDelivery(delivery);
  const showError = delivery.lastError
    && ['retrying', 'stuck', 'exhausted'].includes(delivery.deliveryState);
  return (
    <>
      {line && (
        <p className={`ad-egi-delivery-line${line.alert ? ' ad-egi-delivery-line--alert' : ''}`}>{line.text}</p>
      )}
      {showError && <p className="ad-egi-error">Last error: {delivery.lastError}</p>}
    </>
  );
}

function VerificationDocumentsPanel({ appId, verificationDocuments, locked, onUpload, onDelete }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [docType, setDocType] = useState(VERIFICATION_DOC_TYPES[0].value);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    await onUpload(file, docType, docType === 'other' ? label : undefined);
    setUploading(false);
    setFile(null);
    setLabel('');
  };

  const handleConfirmDelete = (docId) => {
    onDelete(docId);
    setConfirmingId(null);
  };

  return (
    <div className="ad-verification-panel">
      {verificationDocuments.length === 0 ? (
        <p className="ad-empty-hint">No verification documents attached yet.</p>
      ) : (
        <div className="ad-doc-grid">
          {verificationDocuments.map((doc) => (
            <div key={doc.id} className="ad-doc-card ad-doc-card--verification">
              <div className="ad-doc-card-info">
                <span className="ad-doc-card-label">{doc.label}</span>
                <span className="ad-doc-card-name">{doc.name}</span>
                <span className="ad-doc-card-meta">
                  Uploaded by {doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="ad-doc-card-actions">
                <ViewDocumentButton appId={appId} docKey={doc.key}>View</ViewDocumentButton>
                {!locked && (
                  confirmingId === doc.id ? (
                    <>
                      <button type="button" className="ad-doc-confirm-btn" onClick={() => handleConfirmDelete(doc.id)}>
                        Confirm
                      </button>
                      <button type="button" className="ad-doc-cancel-btn" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ad-doc-delete-btn" onClick={() => setConfirmingId(doc.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!locked && (
        <form onSubmit={handleUpload} className="ad-verification-upload-form">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="ad-upload-select">
            {VERIFICATION_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {docType === 'other' && (
            <input
              type="text"
              placeholder="Custom label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="ad-upload-label-input"
              required
            />
          )}
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="ad-upload-file-input"
            required
          />
          <button type="submit" disabled={uploading} className="ad-upload-submit-btn">
            {uploading ? 'Uploading…' : 'Attach Document'}
          </button>
        </form>
      )}
    </div>
  );
}
