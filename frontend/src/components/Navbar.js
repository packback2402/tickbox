import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hàm xử lý đăng xuất
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
    window.location.reload();
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navStyle = {
    background: 'var(--primary-color)',
    color: 'white',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'var(--shadow-md)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  };

  const logoStyle = {
    fontWeight: '700',
    fontSize: 'clamp(18px, 4vw, 24px)',
  };

  const logoLinkStyle = {
    color: 'white',
    textDecoration: 'none',
  };

  const linkStyle = {
    color: 'white',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'opacity 0.3s',
  };

  const buttonStyle = {
    background: 'white',
    color: 'var(--primary-color)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'var(--transition)',
  };

  const mobileMenuStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'var(--primary-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '2rem',
    boxShadow: 'var(--shadow-md)',
    zIndex: 999,
  };

  const hamburgerStyle = {
    display: 'none',
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
  };

  return (
    <nav style={navStyle}>
      <div className="logo" style={logoStyle}>
        <Link to="/" style={logoLinkStyle}>
          Ticketbox
        </Link>
      </div>

      {/* Desktop Menu */}
      <div className="links" style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <Link to="/" style={linkStyle} onMouseEnter={(e) => e.target.style.opacity = '0.8'} onMouseLeave={(e) => e.target.style.opacity = '1'}>
          Trang chủ
        </Link>

        {user ? (
          <>
            <span style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap' }}>
              Hi, {user.email.split('@')[0]}
            </span>

            <Link
              to="/my-tickets"
              style={linkStyle}
              onMouseEnter={(e) => e.target.style.opacity = '0.8'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Vé của tôi
            </Link>

            {user.role === 'admin' && (
              <Link
                to="/admin"
                style={{
                  ...buttonStyle,
                  background: '#ff4d4f',
                  color: 'white',
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                QUẢN TRỊ
              </Link>
            )}

            <button
              onClick={handleLogout}
              style={buttonStyle}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={linkStyle} onMouseEnter={(e) => e.target.style.opacity = '0.8'} onMouseLeave={(e) => e.target.style.opacity = '1'}>
              Đăng nhập
            </Link>
            <Link
              to="/register"
              style={{
                ...buttonStyle,
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid white',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Đăng ký
            </Link>
          </>
        )}
      </div>

      {/* Hamburger Menu for Mobile */}
      <button
        style={{
          ...hamburgerStyle,
          display: 'none',
        }}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
        className="hamburger-menu"
      >
        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div style={mobileMenuStyle} className="mobile-menu">
          <Link to="/" style={linkStyle} onClick={closeMobileMenu}>
            Trang chủ
          </Link>

          {user ? (
            <>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                Hi, {user.email.split('@')[0]}
              </span>
              <Link to="/my-tickets" style={linkStyle} onClick={closeMobileMenu}>
                Vé của tôi
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" style={{ ...linkStyle, color: '#ff4d4f', fontWeight: '700' }} onClick={closeMobileMenu}>
                  QUẢN TRỊ
                </Link>
              )}
              <button onClick={() => { handleLogout(); closeMobileMenu(); }} style={buttonStyle}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={linkStyle} onClick={closeMobileMenu}>
                Đăng nhập
              </Link>
              <Link to="/register" style={{ ...buttonStyle, background: 'rgba(255,255,255,0.2)', border: '2px solid white' }} onClick={closeMobileMenu}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .links {
            display: none !important;
          }
          .hamburger-menu {
            display: block !important;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navbar;