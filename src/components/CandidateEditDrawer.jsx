/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  X, ShieldAlert, Upload, Trash2, FileText,
  User, GraduationCap, FolderOpen, ClipboardList,
  Download, Eye, AlertCircle, CheckCircle2
} from 'lucide-react';
import './styles/CandidateEditDrawer.css';

const TABS = [
  { key: 'personal',   label: 'Personal',   icon: User },
  { key: 'education',  label: 'Education',  icon: GraduationCap },
  { key: 'documents',  label: 'Documents',  icon: FolderOpen },
  { key: 'notes',      label: 'Notes',      icon: ClipboardList },
];

/* Human-readable document slot labels */
const DOC_SLOTS = [
  { key: 'cv',               label: 'Curriculum Vitae (CV)' },
  { key: 'coverLetter',      label: 'Cover Letter' },
  { key: 'passportPhoto',    label: 'Passport Photograph' },
  { key: 'academicCert',     label: 'Academic Certificate' },
  { key: 'nyscCert',         label: 'NYSC Discharge Certificate' },
  { key: 'nationalId',       label: 'National ID / NIN Slip' },
  { key: 'policeReport',     label: 'Police Clearance Report' },
  { key: 'medicalReport',    label: 'Medical Fitness Report' },
  { key: 'guarantorForm',    label: 'Guarantor Form' },
  { key: 'offerLetter',      label: 'Offer Letter' },
  { key: 'employmentLetter', label: 'Employment / Reference Letter' },
  { key: 'others',           label: 'Other Supporting Document' },
];

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers',
  'Sokoto','Taraba','Yobe','Zamfara',
];

/* ── URL type helpers ── */
const isMockUrl   = (url) => !url || url.startsWith('#mock-') || url.startsWith('#uploaded-');
const isBase64Url = (url) => typeof url === 'string' && url.startsWith('data:');
const isRealUrl   = (url) => typeof url === 'string' && (url.startsWith('http') || url.startsWith('/') || url.startsWith('blob:'));

/* A file is downloadable if it has a real or base64 URL */
const isDownloadable = (url) => isBase64Url(url) || isRealUrl(url);

const formatFileSize = (bytes) => {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/* Read a picked File object → base64 data URL */
const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

/* Open viewable types (PDF / images) in a new tab; download everything else */
const viewFile = (doc) => {
  const viewable = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (viewable.includes(doc.type)) {
    const win = window.open();
    if (win) {
      win.document.write(
        `<html><head><title>${doc.name}</title></head>` +
        `<body style="margin:0;background:#111">` +
        `<iframe src="${doc.url}" style="width:100%;height:100vh;border:none"></iframe>` +
        `</body></html>`
      );
      win.document.close();
      return;
    }
  }
  /* Fallback: trigger download via anchor */
  triggerDownload(doc.url, doc.name);
};

/* Programmatic download — mirrors the <a download> pattern from AdminApplications */
const triggerDownload = (url, filename) => {
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/* ═══════════════════════════════════════════════════════════
   DocRow — one document slot
   ═══════════════════════════════════════════════════════════ */
function DocRow({ slotKey, label, doc, onUpload, onRemove, onMockDownloadAttempt }) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onUpload(slotKey, {
        name:       file.name,
        size:       formatFileSize(file.size),
        type:       file.type,
        url:        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    } catch {
      /* silent */
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const canDownload = doc && isDownloadable(doc.url);
  const isMock      = doc && isMockUrl(doc.url);
  const hasDoc      = !!doc;

  return (
    <div className={`ced-doc-slot${canDownload ? ' ced-doc-slot--uploaded' : isMock ? ' ced-doc-slot--mock' : ''}`}>

      {/* Left — icon + info */}
      <div className="ced-doc-slot-left">
        <FileText className={`ced-doc-file-icon${canDownload ? ' ced-doc-icon-real' : isMock ? ' ced-doc-icon-mock' : ''}`} />
        <div className="ced-doc-slot-info">
          <span className="ced-doc-slot-label">{label}</span>

          {canDownload && (
            <span className="ced-doc-slot-name">
              <CheckCircle2 className="ced-doc-check" />
              {doc.name}
              <span className="ced-doc-slot-size"> · {doc.size}</span>
            </span>
          )}

          {isMock && (
            <span className="ced-doc-slot-mock-tag">
              <AlertCircle className="ced-doc-mock-icon" />
              {doc.name}
              <span className="ced-doc-slot-size"> · {doc.size}</span>
            </span>
          )}

          {!hasDoc && (
            <span className="ced-doc-slot-empty">No file uploaded</span>
          )}
        </div>
      </div>

      {/* Right — actions */}
      <div className="ced-doc-slot-actions">

        {/* VIEW — real/base64 files only */}
        {canDownload && (
          <button
            type="button"
            onClick={() => viewFile(doc)}
            className="ced-view-btn"
            title="View document"
          >
            <Eye className="ced-action-icon" />
            <span>View</span>
          </button>
        )}

        {/*
          DOWNLOAD — mirrors AdminApplications pattern exactly:
          Use a native <a download> for real/base64 files.
          For mock files, show the button but intercept with a toast.
        */}
        {hasDoc && (
          canDownload ? (
            /* Native anchor download — same as AdminApplications */
            <a
              href={doc.url}
              download={doc.name}
              className="ced-download-btn"
              title={`Download ${doc.name}`}
            >
              <Download className="ced-action-icon" />
              <span>Download</span>
            </a>
          ) : (
            /* Mock file — button that explains why it can't download */
            <button
              type="button"
              onClick={onMockDownloadAttempt}
              className="ced-download-btn ced-download-btn--mock"
              title="Demo file — replace to download"
            >
              <Download className="ced-action-icon" />
              <span>Download</span>
            </button>
          )
        )}

        {/* UPLOAD / REPLACE */}
        <label className={`ced-upload-btn${uploading ? ' ced-upload-btn--loading' : ''}`}>
          <Upload className="ced-action-icon" />
          <span>{uploading ? 'Reading…' : hasDoc ? 'Replace' : 'Upload'}</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleChange}
            disabled={uploading}
          />
        </label>

        {/* REMOVE */}
        {hasDoc && (
          <button
            type="button"
            onClick={() => onRemove(slotKey)}
            className="ced-remove-btn"
            title="Remove document"
          >
            <Trash2 className="ced-action-icon" />
          </button>
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Drawer
   ═══════════════════════════════════════════════════════════ */
export function CandidateEditDrawer({
  app,
  jobTitle,
  isSuperadmin = false,
  onClose,
  onSave,
  onStatusChange,
  addToast,
}) {
  const [activeTab, setActiveTab] = useState('personal');
  const [personal,  setPersonal]  = useState({ ...app.personalInfo });
  const [education, setEducation] = useState({ ...app.educationInfo });
  const [docs,      setDocs]      = useState({ ...app.documents });
  const [notes,     setNotes]     = useState(app.notes || '');

  useEffect(() => {
    setPersonal({ ...app.personalInfo });
    setEducation({ ...app.educationInfo });
    setDocs({ ...app.documents });
    setNotes(app.notes || '');
  }, [app.id]);

  const handlePersonalChange  = (f, v) => setPersonal((p)  => ({ ...p, [f]: v }));
  const handleEducationChange = (f, v) => setEducation((p) => ({ ...p, [f]: v }));

  const handleUpload = (slotKey, fileObj) =>
    setDocs((prev) => ({ ...prev, [slotKey]: fileObj }));

  const handleRemove = (slotKey) =>
    setDocs((prev) => { const n = { ...prev }; delete n[slotKey]; return n; });

  const handleSave = () =>
    onSave({ ...app, personalInfo: personal, educationInfo: education, documents: docs, notes });

  const handleMockDownloadAttempt = () => {
    if (addToast) {
      addToast('info', 'Demo File', 'This is a seed/demo file with no real content. Replace it by clicking "Replace" to enable download.');
    }
  };

  /* Doc summary counts */
  const docStats = DOC_SLOTS.reduce(
    (acc, { key }) => {
      const d = docs[key];
      if (!d)                      acc.missing++;
      else if (isDownloadable(d.url)) acc.real++;
      else                         acc.mock++;
      return acc;
    },
    { real: 0, mock: 0, missing: 0 }
  );

  /* Count all populated slots (for the tab badge) */
  const totalDocs = Object.keys(docs).length;

  return (
    <div className="ced-overlay">
      <div className="ced-backdrop" onClick={onClose} />

      <div className="ced-drawer">

        {/* Header */}
        <div className="ced-header">
          <div className="ced-header-left">
            <span className="ced-label">
              {isSuperadmin ? 'SUPERADMIN OVERRIDE · CANDIDATE FILE' : 'ADMIN · CANDIDATE FILE'}
            </span>
            <h2 className="ced-name">{app.personalInfo.fullName}</h2>
            <span className="ced-meta">{jobTitle}&nbsp;·&nbsp;Ref:&nbsp;{app.referenceId}</span>
          </div>
          <button onClick={onClose} className="ced-close-btn">
            <X className="ced-close-icon" />
          </button>
        </div>

        {/* Superadmin warning */}
        {isSuperadmin && (
          <div className="ced-warning">
            <ShieldAlert className="ced-warning-icon" />
            <div>
              <strong className="ced-warning-title">Override Mode Active</strong>
              <span className="ced-warning-text"> — All edits bypass normal workflow and log to the compliance audit register.</span>
            </div>
          </div>
        )}

        {/* Tab Bar */}
        <div className="ced-tabs">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`ced-tab${activeTab === key ? ' ced-tab--active' : ''}`}
            >
              <Icon className="ced-tab-icon" />
              {label}
              {key === 'documents' && totalDocs > 0 && (
                <span className={`ced-tab-badge${docStats.real > 0 ? ' ced-tab-badge--green' : ' ced-tab-badge--amber'}`}>
                  {totalDocs}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="ced-body">

          {/* PERSONAL */}
          {activeTab === 'personal' && (
            <div className="ced-section">
              <div className="ced-grid-2">
                <Field label="Full Name">
                  <input className="ced-input" value={personal.fullName || ''} onChange={(e) => handlePersonalChange('fullName', e.target.value)} />
                </Field>
                <Field label="Email Address">
                  <input className="ced-input" type="email" value={personal.email || ''} onChange={(e) => handlePersonalChange('email', e.target.value)} />
                </Field>
                <Field label="Phone Number">
                  <input className="ced-input" value={personal.phone || ''} onChange={(e) => handlePersonalChange('phone', e.target.value)} />
                </Field>
                <Field label="Date of Birth">
                  <input className="ced-input" type="date" value={personal.dob || ''} onChange={(e) => handlePersonalChange('dob', e.target.value)} />
                </Field>
                <Field label="Gender">
                  <select className="ced-select" value={personal.gender || ''} onChange={(e) => handlePersonalChange('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option>Male</option><option>Female</option><option>Prefer not to say</option>
                  </select>
                </Field>
                <Field label="State of Origin">
                  <select className="ced-select" value={personal.stateOfOrigin || ''} onChange={(e) => handlePersonalChange('stateOfOrigin', e.target.value)}>
                    <option value="">Select State</option>
                    {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="LGA">
                  <input className="ced-input" value={personal.lga || ''} onChange={(e) => handlePersonalChange('lga', e.target.value)} />
                </Field>
              </div>
              <Field label="Residential Address">
                <textarea className="ced-textarea" rows={2} value={personal.residentialAddress || ''} onChange={(e) => handlePersonalChange('residentialAddress', e.target.value)} />
              </Field>
            </div>
          )}

          {/* EDUCATION */}
          {activeTab === 'education' && (
            <div className="ced-section">
              <div className="ced-grid-2">
                <Field label="Highest Qualification">
                  <input className="ced-input" value={education.highestQualification || ''} onChange={(e) => handleEducationChange('highestQualification', e.target.value)} />
                </Field>
                <Field label="Institution">
                  <input className="ced-input" value={education.institution || ''} onChange={(e) => handleEducationChange('institution', e.target.value)} />
                </Field>
                <Field label="Year of Graduation">
                  <input className="ced-input" value={education.yearOfGraduation || ''} onChange={(e) => handleEducationChange('yearOfGraduation', e.target.value)} />
                </Field>
                <Field label="Years of Experience">
                  <input className="ced-input" value={education.yearsOfExperience || ''} onChange={(e) => handleEducationChange('yearsOfExperience', e.target.value)} />
                </Field>
                <Field label="Current / Last Employer">
                  <input className="ced-input" value={education.currentEmployer || ''} onChange={(e) => handleEducationChange('currentEmployer', e.target.value)} />
                </Field>
              </div>
              <Field label="Work Summary">
                <textarea className="ced-textarea" rows={4} value={education.workSummary || ''} onChange={(e) => handleEducationChange('workSummary', e.target.value)} />
              </Field>
            </div>
          )}

          {/* DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="ced-section">

              {/* Summary bar */}
              <div className="ced-doc-summary">
                <div className="ced-doc-summary-item ced-doc-summary-real">
                  <CheckCircle2 className="ced-doc-summary-icon" />
                  <span><strong>{docStats.real}</strong> downloadable</span>
                </div>
                <div className="ced-doc-summary-item ced-doc-summary-mock">
                  <AlertCircle className="ced-doc-summary-icon" />
                  <span><strong>{docStats.mock}</strong> demo / seed</span>
                </div>
                <div className="ced-doc-summary-item ced-doc-summary-missing">
                  <FileText className="ced-doc-summary-icon" />
                  <span><strong>{docStats.missing}</strong> not uploaded</span>
                </div>
              </div>

              <p className="ced-doc-hint">
                Click <strong>View</strong> to open a file inline, or <strong>Download</strong> to save it.
                Demo seed files (amber) cannot be downloaded — use <strong>Replace</strong> to swap them with real uploads.
              </p>

              <div className="ced-doc-list">
                {DOC_SLOTS.map(({ key, label }) => (
                  <DocRow
                    key={key}
                    slotKey={key}
                    label={label}
                    doc={docs[key]}
                    onUpload={handleUpload}
                    onRemove={handleRemove}
                    onMockDownloadAttempt={handleMockDownloadAttempt}
                  />
                ))}
              </div>
            </div>
          )}

          {/* NOTES */}
          {activeTab === 'notes' && (
            <div className="ced-section">
              <Field label="Internal Admin Notes">
                <textarea
                  className="ced-textarea ced-textarea--tall"
                  rows={8}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes, vetting observations, credential verification status, interview feedback, or compliance flags for this candidate..."
                />
              </Field>
              <div className="ced-notes-history">
                <span className="ced-notes-history-label">Evaluation History</span>
                <div className="ced-history-list">
                  {app.statusHistory.map((h, i) => (
                    <div key={i} className="ced-history-item">
                      <span className="ced-history-dot" />
                      <span>
                        Status set to <strong className="ced-history-status">{h.status}</strong>
                        {' '}by <span className="ced-history-by">{h.changedBy}</span>
                      </span>
                      <span className="ced-history-time">
                        {new Date(h.timestamp).toLocaleDateString()}{' '}
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="ced-footer">
          <div className="ced-footer-status">
            <span className="ced-footer-current">
              Current status:{' '}
              <span className={`ced-status-pill ced-status-${app.status.toLowerCase()}`}>
                {app.status}
              </span>
            </span>
            {onStatusChange && (
              <div className="ced-status-btns">
                <button type="button" onClick={() => onStatusChange('Rejected')}    className="ced-btn-reject">Reject</button>
                <button type="button" onClick={() => onStatusChange('Shortlisted')} className="ced-btn-shortlist">Shortlist</button>
                {isSuperadmin && (
                  <button type="button" onClick={() => onStatusChange('Approved')}  className="ced-btn-approve">Approve & Sync</button>
                )}
              </div>
            )}
          </div>
          <div className="ced-footer-save">
            <button type="button" onClick={onClose}    className="ced-btn-cancel">Cancel</button>
            <button type="button" onClick={handleSave} className="ced-btn-save">Save Changes</button>
          </div>
        </div>

      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="ced-field">
      <label className="ced-field-label">{label}</label>
      {children}
    </div>
  );
}