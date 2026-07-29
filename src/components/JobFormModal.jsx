/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import { useToast } from '../hooks/useToast';
import { RequirementsBuilder } from './RequirementsBuilder';
import { X, Check } from 'lucide-react';
import './styles/JobFormModal.css';

const DEFAULT_CLIENT_ORG = 'ECO Green Investments Limited';

const DEFAULT_FIELDS = {
  title: '',
  clientOrg: DEFAULT_CLIENT_ORG,
  category: 'Agriculture',
  type: 'Full-time',
  location: '',
  openings: 1,
  salaryRange: '',
  description: '',
  responsibilities: '',
  requirements: '',
  closingDate: '',
  status: 'Active'
};

export function JobFormModal({ editingJob, onClose, onSaved }) {
  const { postJob, editJob } = useJobs();
  const { addToast } = useToast();

  const [formFields, setFormFields] = useState(() =>
    editingJob
      ? {
          title: editingJob.title,
          clientOrg: editingJob.clientOrg || DEFAULT_CLIENT_ORG,
          category: editingJob.category,
          type: editingJob.type,
          location: editingJob.location,
          openings: editingJob.openings,
          salaryRange: editingJob.salaryRange || '',
          description: editingJob.description,
          responsibilities: editingJob.responsibilities,
          requirements: editingJob.requirements,
          closingDate: editingJob.closingDate,
          status: editingJob.status
        }
      : { ...DEFAULT_FIELDS }
  );
  const [requirementsBuilder, setRequirementsBuilder] = useState(() =>
    editingJob ? { ...(editingJob.applicationRequirements || {}) } : {}
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formFields.title.trim() || !formFields.clientOrg.trim() || !formFields.location.trim() || !formFields.closingDate) {
      addToast('error', 'Incomplete Fields', 'Please fill out all mandatory starred parameters.');
      return;
    }

    const saved = editingJob
      ? await editJob({ ...editingJob, ...formFields, applicationRequirements: requirementsBuilder })
      : await postJob({ ...formFields, applicationRequirements: requirementsBuilder });

    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <div className="jfm-overlay">
      <div className="jfm-modal">

        {/* Modal Header */}
        <div className="jfm-modal-header">
          <div>
            <h2 className="jfm-modal-title">
              {editingJob ? `Modify Vacancy: ${editingJob.title}` : 'Post A New Job Vacancy'}
            </h2>
            <p className="jfm-modal-subtitle">Inputs configuration fields define public listings parameters.</p>
          </div>
          <button onClick={onClose} className="jfm-modal-close" aria-label="Close form">
            <X className="jfm-close-icon" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="jfm-form">

          {/* Row 1: Basic Info */}
          <div className="jfm-fields-grid">
            <div className="jfm-field jfm-field-wide">
              <label className="jfm-label">Job Title <span className="jfm-required">*</span></label>
              <input type="text" required placeholder="e.g. Agronomist Field Officer"
                value={formFields.title}
                onChange={(e) => setFormFields({ ...formFields, title: e.target.value })}
                className="jfm-input" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Client Organisation <span className="jfm-required">*</span></label>
              <input type="text" required placeholder="e.g. Ogun Premium Holdings"
                value={formFields.clientOrg}
                onChange={(e) => setFormFields({ ...formFields, clientOrg: e.target.value })}
                className="jfm-input" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Category</label>
              <select value={formFields.category}
                onChange={(e) => setFormFields({ ...formFields, category: e.target.value })}
                className="jfm-select">
                <option value="Agriculture">Agriculture Sector</option>
                <option value="Construction">Construction Sector</option>
                <option value="Administration">Corporate Administration</option>
                <option value="Logistics">Logistics & Supply lines</option>
                <option value="Finance">Finance & Banking</option>
                <option value="ICT">Information Technology (ICT)</option>
              </select>
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Employment Type</label>
              <select value={formFields.type}
                onChange={(e) => setFormFields({ ...formFields, type: e.target.value })}
                className="jfm-select">
                <option value="Full-time">Full-time Operations</option>
                <option value="Part-time">Part-time Operations</option>
                <option value="Contract">Sponsor Contractual (Gig)</option>
                <option value="Temporary">Temporary Support Placement</option>
              </select>
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Location (State + LGA) <span className="jfm-required">*</span></label>
              <input type="text" required placeholder="e.g. Ogun (Abeokuta North)"
                value={formFields.location}
                onChange={(e) => setFormFields({ ...formFields, location: e.target.value })}
                className="jfm-input" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Capacity Slot Openings</label>
              <input type="number" required min={1}
                value={formFields.openings}
                onChange={(e) => setFormFields({ ...formFields, openings: parseInt(e.target.value) || 1 })}
                className="jfm-input" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Salary Range (Optional)</label>
              <input type="text" placeholder="e.g. ₦300k - ₦400k / Month"
                value={formFields.salaryRange}
                onChange={(e) => setFormFields({ ...formFields, salaryRange: e.target.value })}
                className="jfm-input" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Closing Date <span className="jfm-required">*</span></label>
              <input type="date" required
                value={formFields.closingDate}
                onChange={(e) => setFormFields({ ...formFields, closingDate: e.target.value })}
                className="jfm-input" />
            </div>
          </div>

          {/* Row 2: Textareas */}
          <div className="jfm-textareas-grid">
            <div className="jfm-field">
              <label className="jfm-label">Job Description <span className="jfm-required">*</span></label>
              <textarea rows={4} placeholder="Provide overview details and role focus summaries..."
                value={formFields.description}
                onChange={(e) => setFormFields({ ...formFields, description: e.target.value })}
                className="jfm-textarea" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Responsibilities (One per line) <span className="jfm-required">*</span></label>
              <textarea rows={4} placeholder="Oversee field logistics&#10;Monitor fertilizer inventories"
                value={formFields.responsibilities}
                onChange={(e) => setFormFields({ ...formFields, responsibilities: e.target.value })}
                className="jfm-textarea" />
            </div>

            <div className="jfm-field">
              <label className="jfm-label">Requirements (One per line) <span className="jfm-required">*</span></label>
              <textarea rows={4} placeholder="B.Sc in Crop Science&#10;3+ years experience"
                value={formFields.requirements}
                onChange={(e) => setFormFields({ ...formFields, requirements: e.target.value })}
                className="jfm-textarea" />
            </div>
          </div>

          {/* Requirements Builder */}
          <div className="jfm-req-builder">
            <h3 className="jfm-req-builder-title">Dynamic Application Requirements Builder</h3>
            <p className="jfm-req-builder-desc">
              Mark each field Off, Optional, or Required for this vacancy. Fields left Off are completely hidden from the applicant intake form.
            </p>
            <RequirementsBuilder value={requirementsBuilder} onChange={setRequirementsBuilder} />
          </div>

          {/* Footer: Status + Buttons */}
          <div className="jfm-form-footer">
            <div className="jfm-status-row">
              <label className="jfm-label">Save Vacancy State</label>
              <select value={formFields.status}
                onChange={(e) => setFormFields({ ...formFields, status: e.target.value })}
                className="jfm-select jfm-status-select">
                <option value="Active">Publish Now (Active)</option>
                <option value="Draft">Draft Mode (Hidden)</option>
                <option value="Closed">Archive (Closed)</option>
              </select>
            </div>

            <div className="jfm-form-actions">
              <button type="button" onClick={onClose} className="jfm-cancel-btn">
                Cancel
              </button>
              <button type="submit" className="jfm-submit-btn">
                <Check className="jfm-check-icon" />
                <span>{editingJob ? 'Save Vacancy Changes' : 'Publish Open Position'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
