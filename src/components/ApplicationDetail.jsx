import { useState, useMemo, useEffect } from 'react';
import { Eye, Trash2, Edit2, Save, X as XIcon, Send } from 'lucide-react';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { useApplications } from '../hooks/useApplications';
import { FieldRenderer } from './FieldRenderer';
import { EgiNoteModal } from './EgiNoteModal';
import { EgiSyncBadge, EgiDecisionBadge, EgiResendBadge } from './EgiBadges';
import { groupFieldsBySection, getSubfieldsForParent } from '../utils/fieldCatalogHelpers';
import { getLockInfo } from '../utils/applicationLock';
import { VERIFICATION_DOC_TYPES } from '../utils/verificationDocTypes';
import { viewFile } from '../utils/fileView';
import './styles/ApplicationDetail.css';

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
export function ApplicationDetail({ app, currentUser, notes, onNotesChange, onAppUpdated }) {
  const { catalog, isLoading } = useFieldCatalog();
  const { updateApplication, uploadVerificationDocument, deleteVerificationDocument, resendToEgi } = useApplications();

  const [isEditing, setIsEditing] = useState(false);
  const [editedFormData, setEditedFormData] = useState(app.formData);
  const [saving, setSaving] = useState(false);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    setEditedFormData(app.formData);
    setIsEditing(false);
  }, [app.id]);

  const lockInfo = useMemo(() => getLockInfo(app, currentUser), [app, currentUser]);

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
    setResendBusy(false);
    setResendModalOpen(false);
    if (updated) onAppUpdated?.(updated);
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
          <EgiSyncBadge status={app.egiSyncStatus} />
        </div>
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

        {lockInfo.canResend && (
          <button type="button" className="ad-resend-btn" onClick={() => setResendModalOpen(true)}>
            <Send size={14} /> Resend to EGI
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
              <DocumentsPanel fields={fields} documents={app.documents} />
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
                                  <button type="button" className="ad-doc-view-btn" onClick={() => viewFile(doc)}>
                                    <Eye size={12} /> {doc.name}
                                  </button>
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
          verificationDocuments={app.verificationDocuments}
          locked={lockInfo.locked}
          onUpload={handleUploadVerificationDoc}
          onDelete={handleDeleteVerificationDoc}
        />
      </section>

      <section className="ad-section">
        <h3 className="ad-section-title">Administrative Notes</h3>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Annotate credential discrepancies, background check remarks, or vetting approvals here..."
          className="ad-notes-textarea"
        />
      </section>

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

      <EgiNoteModal
        open={resendModalOpen}
        busy={resendBusy}
        title="Resend to EGI"
        confirmLabel="Resend & Sync"
        description={`Resending ${app.applicantName} sends a new note to EGI and resets the decision to pending.`}
        onCancel={() => setResendModalOpen(false)}
        onConfirm={handleResendConfirm}
      />
    </div>
  );
}

/* ── Applicant documents (view-only) ────────────────────────────────────── */
function DocumentsPanel({ fields, documents }) {
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
          <button type="button" onClick={() => viewFile(item)} className="ad-doc-view-btn">
            <Eye size={14} /> View
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Verification documents (admin-uploaded, with upload/delete) ─────────── */
function VerificationDocumentsPanel({ verificationDocuments, locked, onUpload, onDelete }) {
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
                <button type="button" onClick={() => viewFile(doc)} className="ad-doc-view-btn">
                  <Eye size={14} /> View
                </button>
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
