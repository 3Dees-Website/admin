import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { FaLinkedinIn, FaFacebookF } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { LogoSVG } from './Navbar';
import './styles/Footer.css';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" id="3dees-system-footer">

      <div className="footer-brand-bar" />

      <div className="footer-grid">

        {/* Column 1: About */}
        <div className="footer-col footer-col--about">
          <LogoSVG />
          <p className="footer-about-text">
            3DEES Consulting Works (RC: 9160527) is a trusted, licensed Nigerian workforce solutions
            firm committed to aligning high-performing candidates with professional corporate sponsors
            across Sub-Saharan Africa.
          </p>
          <div className="footer-socials">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="LinkedIn">
              <FaLinkedinIn size={14} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="X / Twitter">
              <FaXTwitter size={14} />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="Facebook">
              <FaFacebookF size={14} />
            </a>
          </div>
        </div>

        {/* Column 2: Quick Links */}
        <div className="footer-col">
          <h4 className="footer-col-label">Quick Links</h4>
          <div className="footer-col-rule" />
          <ul className="footer-link-list">
            <li><Link to="/" className="footer-link">Home Landing</Link></li>
            <li><Link to="/jobs" className="footer-link">Career Opportunities</Link></li>
            <li><Link to="/about" className="footer-link">Who We Are</Link></li>
            <li><Link to="/contact" className="footer-link">Get In Touch</Link></li>
          </ul>
        </div>

        {/* Column 3: Services */}
        <div className="footer-col">
          <p className="footer-col-label">Operations Spectrum</p>
          <div className="footer-col-rule" />
          <ul className="footer-link-list footer-link-list--plain">
            <li>Recruitment &amp; Staffing</li>
            <li>Workforce Resource Planning</li>
            <li>Human Resource Consultation</li>
            <li>Organisational Compliance Audits</li>
          </ul>
        </div>

        {/* Column 4: Contact */}
        <div className="footer-col">
          <p className="footer-col-label">Headquarters</p>
          <div className="footer-col-rule" />
          <ul className="footer-contact-list">
            <li className="footer-contact-item">
              <div className="footer-contact-icon-wrap">
                <MapPin size={14} />
              </div>
              <span>Suite D66 Efab Mall, Area 11, Garki Abuja FCT, Nigeria</span>
            </li>
            <li className="footer-contact-item">
              <div className="footer-contact-icon-wrap">
                <Phone size={14} />
              </div>
              <span>+234-8149599505<br />+234-9071766667</span>
            </li>
            <li className="footer-contact-item">
              <div className="footer-contact-icon-wrap">
                <Mail size={14} />
              </div>
              <a href="mailto:consultingworks@3dees.net" className="footer-link footer-link--accent">
                consultingworks@3dees.net
              </a>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom">
        <p className="footer-copy">© {currentYear} 3DEES Consulting Works. All Rights Reserved.</p>
        <div className="footer-badges">
          <span className="footer-badge">RC: 9160527</span>
          <span className="footer-badge">Registered Corporate Workforce Solutions Provider</span>
        </div>
      </div>

    </footer>
  );
}