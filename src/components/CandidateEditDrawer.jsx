/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  X, ShieldAlert, Upload, Trash2, FileText,
  User, GraduationCap, FolderOpen, ClipboardList
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

export function CandidateEditDrawer({ app, jobTitle, isSuperadmin = false, onClose, onSave, onStatusChange }) {
  const [activeTab, setActiveTab] = useState('personal');

  /* ── Personal Info ── */
  const [personal, setPersonal] = useState({ ...app.personalInfo });

  /* ── Education Info ── */
  const [education, setEducation] = useState({ ...app.educationInfo });

  /* ── Documents ── */
  const [docs, setDocs] = useState({ ...app.documents });

  /* ── Notes ── */
  const [notes, setNotes] = useState(app.notes || '');

  /* Keep in sync if parent passes updated app */
  useEffect(() => {
    setPersonal({ ...app.personalInfo });
    setEducation({ ...app.educationInfo });
    setDocs({ ...app.documents });
    setNotes(app.notes || '');
  }, [app.id]);

  /* ── Helpers ── */
  const handlePersonalChange = (field, value) =>
    setPersonal((prev) => ({ ...prev, [field]: value }));

  const handleEducationChange = (field, value) =>
    setEducation((prev) => ({ ...prev, [field]: value }));

  const handleFileUpload = (slotKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    /* Store metadata only — no binary data in localStorage */
    setDocs((prev) => ({
      ...prev,
      [slotKey]: {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        url:  '#uploaded-' + Date.now(),
        uploadedAt: new Date().toISOString(),
      },
    }));
  };

  const handleRemoveDoc = (slotKey) => {
    setDocs((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSave = () => {
    onSave({
      ...app,
      personalInfo:  personal,
      educationInfo: education,
      documents:     docs,
      notes,
    });
  };

  return (
    <div className="ced-overlay">
      <div className="ced-backdrop" onClick={onClose} />

      <div className="ced-drawer">

        {/* ── Header ── */}
        <div className="ced-header">
          <div className="ced-header-left">
            <span className="ced-label">
              {isSuperadmin ? 'SUPERADMIN OVERRIDE · CANDIDATE FILE' : 'ADMIN · CANDIDATE FILE'}
            </span>
            <h2 className="ced-name">{app.personalInfo.fullName}</h2>
            <span className="ced-meta">{jobTitle} &nbsp;·&nbsp; Ref: {app.referenceId}</span>
          </div>
          <button onClick={onClose} className="ced-close-btn">
            <X className="ced-close-icon" />
          </button>
        </div>

        {/* ── Warning (superadmin only) ── */}
        {isSuperadmin && (
          <div className="ced-warning">
            <ShieldAlert className="ced-warning-icon" />
            <div>
              <strong className="ced-warning-title">Override Mode Active</strong>
              <span className="ced-warning-text"> — All edits bypass normal workflow and log to the compliance audit register.</span>
            </div>
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className="ced-tabs">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`ced-tab${activeTab === key ? ' ced-tab--active' : ''}`}
            >
              <Icon className="ced-tab-icon" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Body ── */}
        <div className="ced-body">

          {/* PERSONAL TAB */}
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
                    <option>Male</option>
                    <option>Female</option>
                    <option>Prefer not to say</option>
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

          {/* EDUCATION TAB */}
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

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="ced-section">
              <p className="ced-doc-hint">
                Upload or replace documents for this candidate. Supported: PDF, JPG, PNG, DOCX. All uploads are stored as metadata references.
              </p>
              <div className="ced-doc-list">
                {DOC_SLOTS.map(({ key, label }) => {
                  const existing = docs[key];
                  return (
                    <div key={key} className="ced-doc-slot">
                      <div className="ced-doc-slot-left">
                        <FileText className="ced-doc-file-icon" />
                        <div className="ced-doc-slot-info">
                          <span className="ced-doc-slot-label">{label}</span>
                          {existing ? (
                            <span className="ced-doc-slot-name">
                              {existing.name}
                              <span className="ced-doc-slot-size"> · {existing.size}</span>
                            </span>
                          ) : (
                            <span className="ced-doc-slot-empty">No file uploaded</span>
                          )}
                        </div>
                      </div>
                      <div className="ced-doc-slot-actions">
                        <label className="ced-upload-btn">
                          <Upload className="ced-upload-icon" />
                          {existing ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(key, e)}
                          />
                        </label>
                        {existing && (
                          <button
                            onClick={() => handleRemoveDoc(key)}
                            className="ced-remove-btn"
                            title="Remove document"
                          >
                            <Trash2 className="ced-remove-icon" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOTES TAB */}
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
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="ced-footer">
          {/* Status actions */}
          <div className="ced-footer-status">
            <span className="ced-footer-current">
              Current status: <span className={`ced-status-pill ced-status-${app.status.toLowerCase()}`}>{app.status}</span>
            </span>
            {onStatusChange && (
              <div className="ced-status-btns">
                <button onClick={() => onStatusChange('Rejected')}   className="ced-btn-reject">Reject</button>
                <button onClick={() => onStatusChange('Shortlisted')} className="ced-btn-shortlist">Shortlist</button>
                {isSuperadmin && (
                  <button onClick={() => onStatusChange('Approved')} className="ced-btn-approve">Approve & Sync</button>
                )}
              </div>
            )}
          </div>
          {/* Save / Cancel */}
          <div className="ced-footer-save">
            <button onClick={onClose}  className="ced-btn-cancel">Cancel</button>
            <button onClick={handleSave} className="ced-btn-save">Save Changes</button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* Small helper so Field markup stays clean */
function Field({ label, children }) {
  return (
    <div className="ced-field">
      <label className="ced-field-label">{label}</label>
      {children}
    </div>
  );
}