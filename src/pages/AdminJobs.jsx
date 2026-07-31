/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { useJobStats } from '../hooks/useJobStats';
import { useToast } from '../hooks/useToast';
import { JobFormModal } from '../components/JobFormModal';
import { Plus, Edit2, ToggleLeft, ToggleRight, Trash2, ShieldAlert } from 'lucide-react';
import { effectiveStatus } from '../utils/jobStatus';
import './styles/AdminJobs.css';

export function AdminJobs() {
  const { jobs, editJob, removeJob } = useJobs();
  const { statsByJob } = useJobStats();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);

  useEffect(() => {
    if (searchParams.get('create') === 'open') {
      setEditingJob(null);
      setModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleOpenEdit = (job) => {
    setEditingJob(job);
    setModalOpen(true);
  };

  const handleToggleStatus = (job) => {
    const nextStatus = job.status === 'Active' ? 'Closed' : job.status === 'Closed' ? 'Draft' : 'Active';
    editJob({ ...job, status: nextStatus });
    addToast('info', 'Status Shifted', `"${job.title}" state toggled to ${nextStatus}.`);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      removeJob(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="aj-wrapper" id="admin-jobs-wrapper">

      {/* Header */}
      <div className="aj-header-card">
        <div>
          <h1 className="aj-title">Manage Open Vacancies</h1>
          <p className="aj-subtitle">Configure vacancy details and specify mandatory documents for candidates.</p>
        </div>
        <button
          onClick={() => { setEditingJob(null); setModalOpen(true); }}
          className="aj-create-btn"
          id="btn-create-vacancy"
        >
          <Plus className="aj-btn-icon" />
          <span>Create New Job Vacancy</span>
        </button>
      </div>

      {/* Table */}
      <div className="aj-table-card">
        <div className="aj-table-scroll">
          <table className="aj-table">
            <thead>
              <tr className="aj-thead-row">
                <th className="aj-th">Vacancy Title</th>
                <th className="aj-th">Client Org</th>
                <th className="aj-th">Location</th>
                <th className="aj-th aj-th-center">Submissions</th>
                <th className="aj-th aj-th-center">Status</th>
                <th className="aj-th aj-th-right">Operations</th>
              </tr>
            </thead>
            <tbody className="aj-tbody">
              {jobs.map((j) => (
                <tr key={j.id} className="aj-row">
                  <td className="aj-td">
                    <div className="aj-job-info">
                      <span className="aj-job-title">{j.title}</span>
                      <span className="aj-job-meta">{j.category} • {j.type}</span>
                    </div>
                  </td>
                  <td className="aj-td aj-muted">{j.clientOrg}</td>
                  <td className="aj-td aj-muted">{j.location}</td>
                  <td className="aj-td aj-td-center aj-app-count">{statsByJob[j.id]?.total || 0} / {j.openings ?? '—'}</td>
                  <td className="aj-td aj-td-center">
                    <span className={`aj-status-badge aj-status-${effectiveStatus(j, statsByJob[j.id]?.total ?? 0).toLowerCase()}`}>{effectiveStatus(j, statsByJob[j.id]?.total ?? 0)}</span>
                  </td>
                  <td className="aj-td aj-td-right">
                    <div className="aj-actions">
                      <button onClick={() => handleToggleStatus(j)} className="aj-toggle-btn" title="Toggle Status">
                        {j.status === 'Active'
                          ? <ToggleRight className="aj-toggle-icon aj-toggle-on" />
                          : <ToggleLeft className="aj-toggle-icon" />}
                        <span>Toggle Status</span>
                      </button>
                      <button onClick={() => handleOpenEdit(j)} className="aj-icon-btn" title="Edit Vacancy">
                        <Edit2 className="aj-icon" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(j.id)} className="aj-icon-btn aj-icon-btn-del" title="Delete Vacancy">
                        <Trash2 className="aj-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="aj-empty-row">
                    No vacancies are currently posted in the local database storage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <JobFormModal
          editingJob={editingJob}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (
        <div className="aj-overlay">
          <div className="aj-delete-modal">
            <div className="aj-delete-body">
              <ShieldAlert className="aj-danger-icon" />
              <div>
                <h3 className="aj-delete-title">Confirm Destructive Deletion</h3>
                <p className="aj-delete-desc">
                  This operation is permanent. It clears the open vacancy from all local registries. Applicants files remain unaffected but disconnected.
                </p>
              </div>
            </div>
            <div className="aj-delete-footer">
              <button onClick={() => setConfirmDeleteId(null)} className="aj-cancel-btn">
                Retain Job
              </button>
              <button onClick={handleConfirmDelete} className="aj-delete-confirm-btn">
                Delete Job Vacancy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}