import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './styles/Navbar.css';

export function LogoSVG() {
  return (
    <div className="logo-wrap">
      <img src="/3dees_Logo.png" alt="" width={130} />
    </div>
  );
}

export function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navigation = [
    { name: 'Home', path: '/' },
    { name: 'Jobs', path: '/jobs' },
    { name: 'About Us', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const handleLinkClick = () => setMobileOpen(false);

  const getDashboardPath = () => {
    if (!currentUser) return '/admin/login';
    return currentUser.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard';
  };

  const isActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const drawerVariants = {
    hidden: { opacity: 0, y: -12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: 0.16, ease: 'easeIn' },
    },
  };

  const linkVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.045, duration: 0.2, ease: 'easeOut' },
    }),
  };

  return (
    <motion.nav
      className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}
      id="portal-navbar"
      initial={{ y: -72 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="navbar-inner">

        {/* Logo */}
        <Link to="/" className="navbar-logo-link" onClick={handleLinkClick}>
          <motion.div whileHover={{ scale: 1.03 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <LogoSVG />
          </motion.div>
        </Link>

        {/* Desktop Menu */}
        <div className="navbar-desktop-links">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`nav-link${isActive(item.path) ? ' nav-link--active' : ''}`}
              id={`nav-link-${item.name.toLowerCase().replace(' ', '-')}`}
            >
              {item.name}
              {isActive(item.path) && (
                <motion.div
                  layoutId="activeNavLine"
                  className="nav-active-line"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="navbar-desktop-ctas">
          {currentUser ? (
            <div className="navbar-user-actions">
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to={getDashboardPath()}
                  className="btn-nav-dashboard"
                  id="navbar-dashboard-link"
                >
                  <User size={14} className="btn-nav-icon" />
                  <span>Dashboard</span>
                </Link>
              </motion.div>
              <motion.button
                onClick={logout}
                className="btn-nav-logout"
                id="navbar-logout-btn"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </motion.button>
            </div>
          ) : (
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Link to="/admin/login" className="btn-nav-login" id="navbar-login-btn">
                Admin Login
              </Link>
            </motion.div>
          )}
        </div>

        {/* Mobile Toggle */}
        <motion.button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="navbar-mobile-toggle"
          id="navbar-mobile-toggle"
          aria-label="Toggle navigation"
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mobileOpen ? 'close' : 'open'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mobile-drawer"
            id="mobile-nav-drawer"
          >
            {navigation.map((item, i) => (
              <motion.div key={item.name} custom={i} variants={linkVariants} initial="hidden" animate="visible">
                <Link
                  to={item.path}
                  onClick={handleLinkClick}
                  className={`mobile-nav-link${isActive(item.path) ? ' mobile-nav-link--active' : ''}`}
                >
                  <span>{item.name}</span>
                  <ChevronRight size={16} className="mobile-nav-chevron" />
                </Link>
              </motion.div>
            ))}

            <motion.div
              className="mobile-nav-cta-group"
              custom={navigation.length}
              variants={linkVariants}
              initial="hidden"
              animate="visible"
            >
              {currentUser ? (
                <>
                  <div className="mobile-user-label">
                    <User size={14} className="mobile-user-icon" />
                    <span>{currentUser.name}</span>
                  </div>
                  <Link
                    to={getDashboardPath()}
                    onClick={handleLinkClick}
                    className="btn-mobile-dashboard"
                  >
                    Manage Dashboard
                  </Link>
                  <button
                    onClick={() => { logout(); handleLinkClick(); }}
                    className="btn-mobile-logout"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  onClick={handleLinkClick}
                  className="btn-mobile-login"
                >
                  <span>Portal Login</span>
                  <ChevronRight size={16} />
                </Link>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}