import { Upload, FileCheck, X } from 'lucide-react';
import { getSubfieldsOf, validateFile, deriveAge } from '../utils/enrollmentValidation';
import { PhotoCaptureControl } from './CameraCapture';
import './styles/EnrollmentFieldRenderer.css';

/**
 * One input for one field-catalog field in the Enroll Applicant wizard, driven
 * by the field's `type`. Renders an experience-trio's Years/Detail/Proof
 * sub-fields beneath a "Yes"-answered yesno field. Unlike FieldRenderer (the
 * inline editor inside ApplicationDetail), this one also takes files and photos.
 */
export function EnrollmentFieldRenderer({
  field,
  required,
  answers,
  files,
  errors,
  catalog,
  disabled = false,
  onAnswerChange,
  onFileChange,
  onFileAdd,
  onFileRemoveAt,
  addToast,
}) {
  const value = answers[field.key];
  const error = errors[field.key];
  const inputId = `en-${field.key}`;
  const errClass = error ? ' en-input--err' : '';
  const labelNode = (
    <label className="en-label" htmlFor={inputId}>
      {field.label} {required ? <span className="en-required">*</span> : <span className="en-optional">(Optional)</span>}
    </label>
  );
  const errorNode = error && <span className="en-error-msg" role="alert">{error}</span>;
  const handleTextChange = (e) => onAnswerChange(field.key, e.target.value);

  switch (field.type) {
    case 'text':
    case 'tel':
    case 'email':
      return (
        <div className="en-field">
          {labelNode}
          <input
            id={inputId}
            type={field.type}
            value={value ?? ''}
            disabled={disabled}
            onChange={handleTextChange}
            className={`en-input${errClass}`}
          />
          {errorNode}
        </div>
      );

    case 'textarea':
      return (
        <div className="en-field en-field--full">
          {labelNode}
          <textarea
            id={inputId}
            rows={3}
            value={value ?? ''}
            disabled={disabled}
            onChange={handleTextChange}
            className={`en-textarea${errClass}`}
          />
          {errorNode}
        </div>
      );

    case 'number':
    case 'year':
      return (
        <div className="en-field">
          {labelNode}
          <input
            id={inputId}
            type="number"
            value={value ?? ''}
            min={field.validation?.min}
            max={field.validation?.max}
            disabled={disabled}
            onChange={handleTextChange}
            className={`en-input${errClass}`}
          />
          {errorNode}
        </div>
      );

    case 'date': {
      const age = field.key === 'dateOfBirth' ? deriveAge(value) : null;
      return (
        <div className="en-field">
          {labelNode}
          <input
            id={inputId}
            type="date"
            value={value ?? ''}
            disabled={disabled}
            onChange={handleTextChange}
            className={`en-input${errClass}`}
          />
          {age !== null && <span className="en-age-preview">Age: {age} years</span>}
          {errorNode}
        </div>
      );
    }

    case 'select': {
      if (field.key === 'lga') {
        const stateValue = answers.stateOfOrigin;
        const lgaOptions = stateValue ? catalog.lgasByState?.[stateValue] : null;
        if (!lgaOptions || lgaOptions.length === 0) {
          // Free text until a state with known LGAs is chosen.
          return (
            <div className="en-field">
              {labelNode}
              <input
                id={inputId}
                type="text"
                placeholder={stateValue ? 'Enter the LGA' : 'Select a State of Origin first'}
                value={value ?? ''}
                disabled={disabled}
                onChange={handleTextChange}
                className={`en-input${errClass}`}
              />
              {errorNode}
            </div>
          );
        }
        return (
          <div className="en-field">
            {labelNode}
            <select id={inputId} value={value ?? ''} disabled={disabled} onChange={handleTextChange} className={`en-select${errClass}`}>
              <option value="">Select LGA</option>
              {lgaOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {errorNode}
          </div>
        );
      }
      return (
        <div className="en-field">
          {labelNode}
          <select id={inputId} value={value ?? ''} disabled={disabled} onChange={handleTextChange} className={`en-select${errClass}`}>
            <option value="">Select {field.label}</option>
            {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {errorNode}
        </div>
      );
    }

    case 'yesno': {
      const subfields = getSubfieldsOf(catalog, field.key);
      return (
        <div className={`en-field${subfields.length ? ' en-field--full' : ''}`}>
          <span className="en-label">
            {field.label} {required ? <span className="en-required">*</span> : <span className="en-optional">(Optional)</span>}
          </span>
          <div className="en-yesno" role="radiogroup" aria-label={field.label}>
            {['Yes', 'No'].map((opt) => (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={value === opt}
                disabled={disabled}
                onClick={() => onAnswerChange(field.key, opt)}
                className={`en-yesno-btn${value === opt ? ' en-yesno-btn--active' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>
          {errorNode}
          {subfields.length > 0 && value === 'Yes' && (
            <div className="en-experience">
              {subfields.map((sub) => (
                <EnrollmentFieldRenderer
                  key={sub.key}
                  field={sub}
                  required={false}
                  answers={answers}
                  files={files}
                  errors={errors}
                  catalog={catalog}
                  disabled={disabled}
                  onAnswerChange={onAnswerChange}
                  onFileChange={onFileChange}
                  onFileAdd={onFileAdd}
                  onFileRemoveAt={onFileRemoveAt}
                  addToast={addToast}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'declaration':
      return (
        <div className={`en-declaration${error ? ' en-declaration--err' : ''}`}>
          <label className="en-declaration-label">
            <input
              type="checkbox"
              checked={value === true}
              disabled={disabled}
              onChange={(e) => onAnswerChange(field.key, e.target.checked)}
            />
            <span>{field.label} {required && <span className="en-required">*</span>}</span>
          </label>
          {errorNode}
        </div>
      );

    case 'file': {
      const accept = field.validation?.mimeTypes?.join(',');
      const maxFiles = field.multiple ? (field.validation?.maxFiles ?? 5) : 1;
      const current = files[field.key];
      const currentList = field.multiple ? (current || []) : (current ? [current] : []);

      const handlePick = (e) => {
        const picked = Array.from(e.target.files || []);
        e.target.value = ''; // allow re-picking the same file after removal
        let count = currentList.length;
        picked.forEach((file) => {
          const err = validateFile(field, file);
          if (err) {
            addToast('error', 'File Upload Error', err);
            return;
          }
          if (field.multiple) {
            if (count >= maxFiles) {
              addToast('error', 'File Upload Error', `Maximum of ${maxFiles} files.`);
              return;
            }
            count += 1;
            onFileAdd(field.key, file);
          } else {
            onFileChange(field.key, file);
          }
        });
      };

      // Image-only fields (today just passportPhotoUpload) also offer the camera.
      const mimeTypes = field.validation?.mimeTypes;
      const isImageOnly = !field.multiple && mimeTypes?.length > 0 && mimeTypes.every((t) => t.startsWith('image/'));

      const uploadButton = (
        <label className="en-upload-btn">
          <Upload className="en-upload-icon" />
          <span>{field.multiple ? 'Attach File' : 'Choose File'}</span>
          <input
            type="file"
            multiple={field.multiple}
            accept={accept}
            disabled={disabled}
            onChange={handlePick}
            className="en-file-hidden"
          />
        </label>
      );

      return (
        <div className="en-doc-block">
          <span className="en-label">
            {field.label} {required ? <span className="en-required">*</span> : <span className="en-optional">(Optional)</span>}
          </span>

          {(!field.multiple ? currentList.length === 0 : currentList.length < maxFiles) && (
            isImageOnly ? (
              <div className="cc-actions">
                {uploadButton}
                <PhotoCaptureControl field={field} onCapture={(file) => onFileChange(field.key, file)} />
              </div>
            ) : uploadButton
          )}

          {currentList.length > 0 && (
            <div className="en-doc-list">
              {currentList.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="en-doc-attached">
                  <FileCheck className="en-doc-check" />
                  <span className="en-doc-name" title={file.name}>{file.name}</span>
                  <span className="en-doc-size">({(file.size / (1024 * 1024)).toFixed(1)}MB)</span>
                  <button
                    type="button"
                    className="en-doc-remove"
                    disabled={disabled}
                    onClick={() => onFileRemoveAt(field.key, field.multiple ? idx : undefined)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="en-doc-remove-icon" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {field.multiple && <span className="en-doc-hint">{currentList.length}/{maxFiles} files attached</span>}
          {errorNode}
        </div>
      );
    }

    default:
      return null;
  }
}
