import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useRouteBase } from '../hooks/useRouteBase';
import './styles/EnrollApplicantLink.css';

/** The "Enroll Applicant" entry point shown in the header of the application lists. */
export function EnrollApplicantLink({ className = '' }) {
  const routeBase = useRouteBase();
  return (
    <Link to={`${routeBase}/enroll`} className={`eal-btn ${className}`.trim()} id="btn-enroll-applicant">
      <UserPlus className="eal-icon" aria-hidden="true" />
      <span>Enroll Applicant</span>
    </Link>
  );
}
