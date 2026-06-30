import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaBars, FaTimes, FaSearch, FaMapMarkerAlt, FaSlidersH,
  FaChevronDown, FaTicketAlt, FaUser, FaSignOutAlt,
  FaTachometerAlt, FaUserShield
} from 'react-icons/fa';
import api from '../api';

const LOCATIONS = [
  { value: 'all',          label: 'Toàn quốc' },
  { value: 'Ho Chi Minh',  label: 'Hồ Chí Minh' },
  { value: 'Ha Noi',       label: 'Hà Nội' },
  { value: 'Da Nang',      label: 'Đà Nẵng' },
  { value: 'Da Lat',       label: 'Đà Lạt' },
  { value: 'other',        label: 'Vị trí khác' },
];

// --- Avatar placeholder (initials) ---
const AvatarPlaceholder = ({ name, size = 36 }) => {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #25a562, #1a7a48)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700', fontSize: size * 0.38,
      flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)',
    }}>
      {initials}
    </div>
  );
};

// --- Main Navbar ---
const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const [searchQuery,        setSearchQuery]        = useState('');
  const [showSearchPanel,    setShowSearchPanel]     = useState(false);
  const [selectedLocation,   setSelectedLocation]    = useState('all');
  const [selectedCategories, setSelectedCategories]  = useState([]);
  const [categories,         setCategories]          = useState([]);
  const [showAccountMenu,    setShowAccountMenu]     = useState(false);
  const [isMobileMenuOpen,   setIsMobileMenuOpen]    = useState(false);

  const searchWrapRef = useRef(null);
  const accountRef    = useRef(null);

  useEffect(() => {
    api.get('/api/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => {
      try { setUser(JSON.parse(localStorage.getItem('user'))); } catch { setUser(null); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSearchPanel(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowAccountMenu(false);
    navigate('/');
  };

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (searchQuery.trim())         p.set('q', searchQuery.trim());
    if (selectedLocation !== 'all') p.set('location', selectedLocation);
    selectedCategories.forEach(id  => p.append('cat', id));
    return p;
  }, [searchQuery, selectedLocation, selectedCategories]);

  const handleSearch = useCallback((e) => {
    e && e.preventDefault();
    navigate(`/search?${buildParams().toString()}`);
    setShowSearchPanel(false);
    setIsMobileMenuOpen(false);
  }, [navigate, buildParams]);

  const handleApply = () => {
    navigate(`/search?${buildParams().toString()}`);
    setShowSearchPanel(false);
  };

  const handleReset = () => {
    setSelectedLocation('all');
    setSelectedCategories([]);
  };

  const toggleCategory = (id) =>
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );

  const displayName = user
    ? (user.full_name || user.org_name || user.email?.split('@')[0] || 'Tài khoản')
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .ti-navbar {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #2CC275 0%, #22a460 100%);
          position: sticky; top: 0; z-index: 1000;
          box-shadow: 0 2px 14px rgba(34,164,96,0.28);
        }

        .ti-topbar {
          display: flex; align-items: center; gap: 14px;
          padding: 0 24px; height: 62px;
          max-width: 1400px; margin: 0 auto;
        }

        /* Logo — all white, no color split */
        .ti-logo {
          font-size: 23px; font-weight: 800; color: white;
          text-decoration: none; letter-spacing: -0.5px; flex-shrink: 0;
          font-family: 'Inter', sans-serif;
        }

        /* Search outer */
        .ti-search-outer { position: relative; flex: 1; max-width: 540px; }

        .ti-search-bar {
          display: flex; align-items: center;
          background: rgba(255,255,255,0.17);
          border: 1.5px solid rgba(255,255,255,0.30);
          border-radius: 50px; overflow: hidden;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, border-radius 0.15s;
          cursor: text;
        }
        .ti-search-bar:focus-within { background: rgba(255,255,255,0.26); border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 3px rgba(255,255,255,0.13); }
        .ti-search-bar.open         { background: rgba(255,255,255,0.26); border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 3px rgba(255,255,255,0.13); border-radius: 14px 14px 0 0; border-bottom-color: transparent; }

        .ti-search-icon { padding: 0 10px 0 15px; color: rgba(255,255,255,0.72); display: flex; align-items: center; font-size: 14px; flex-shrink: 0; }
        .ti-search-input {
          flex: 1; background: none; border: none; outline: none;
          color: white; font-size: 14px; font-family: 'Inter', sans-serif; padding: 10px 0; min-width: 0;
        }
        .ti-search-input::placeholder { color: rgba(255,255,255,0.60); }

        .ti-search-submit {
          background: rgba(255,255,255,0.20); color: white; border: none;
          padding: 10px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Inter', sans-serif; white-space: nowrap;
          border-left: 1px solid rgba(255,255,255,0.20); transition: background 0.18s;
        }
        .ti-search-submit:hover { background: rgba(255,255,255,0.30); }
        .ti-search-bar.open .ti-search-submit { border-radius: 0 12px 0 0; }

        /* Search dropdown panel */
        .ti-search-panel {
          position: absolute; top: 100%; left: 0; right: 0;
          background: #ffffff; border-radius: 0 0 18px 18px;
          box-shadow: 0 14px 44px rgba(0,0,0,0.16);
          z-index: 1100; padding: 18px 20px 16px;
          animation: panelIn 0.17s ease;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ti-panel-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 10.5px; font-weight: 700; color: #999;
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px;
        }
        .ti-panel-label svg { color: #2CC275; }

        .ti-radio-group { display: flex; flex-wrap: wrap; gap: 7px; }
        .ti-radio-pill {
          padding: 6px 13px; border-radius: 50px;
          border: 1.5px solid #e2e2e2; background: white;
          font-size: 13px; font-weight: 500; color: #555;
          cursor: pointer; transition: all 0.15s; user-select: none;
          display: inline-flex; align-items: center; font-family: 'Inter', sans-serif;
        }
        .ti-radio-pill input { display: none; }
        .ti-radio-pill:hover { border-color: #2CC275; color: #2CC275; }
        .ti-radio-pill.selected { background: #2CC275; color: white; border-color: #2CC275; font-weight: 600; }

        .ti-panel-divider { height: 1px; background: #f0f0f0; margin: 14px 0; }

        .ti-cat-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .ti-cat-chip {
          padding: 6px 13px; border-radius: 50px;
          border: 1.5px solid #e2e2e2; background: white;
          font-size: 13px; font-weight: 500; color: #555;
          cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif;
        }
        .ti-cat-chip:hover { border-color: #2CC275; color: #2CC275; }
        .ti-cat-chip.selected { background: #2CC275; color: white; border-color: #2CC275; font-weight: 600; }

        .ti-panel-actions { display: flex; gap: 9px; margin-top: 16px; }
        .ti-btn-reset {
          flex: 1; padding: 10px; border-radius: 10px;
          border: 1.5px solid #ddd; color: #555; background: white;
          font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s;
        }
        .ti-btn-reset:hover { border-color: #2CC275; color: #2CC275; }
        .ti-btn-apply {
          flex: 2; padding: 10px; border-radius: 10px;
          background: #2CC275; color: white; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; transition: background 0.15s;
        }
        .ti-btn-apply:hover { background: #25a562; }

        /* Nav actions */
        .ti-nav-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
        .ti-nav-btn {
          display: flex; align-items: center; gap: 7px;
          color: white; text-decoration: none; font-size: 13px; font-weight: 500;
          padding: 7px 14px; border-radius: 50px;
          border: 1.5px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.11);
          transition: all 0.18s; cursor: pointer; white-space: nowrap; font-family: 'Inter', sans-serif;
        }
        .ti-nav-btn:hover { background: rgba(255,255,255,0.22); }
        .ti-nav-btn-solid { background: white; color: #1a8a50; font-weight: 600; border-color: white; }
        .ti-nav-btn-solid:hover { background: rgba(255,255,255,0.9); box-shadow: 0 3px 10px rgba(0,0,0,0.11); }

        /* Account */
        .ti-account-wrap { position: relative; }
        .ti-account-btn {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.13); border: 1.5px solid rgba(255,255,255,0.28);
          border-radius: 50px; padding: 5px 11px 5px 5px;
          cursor: pointer; color: white; font-family: 'Inter', sans-serif; transition: all 0.18s;
        }
        .ti-account-btn:hover { background: rgba(255,255,255,0.23); }
        .ti-account-name { font-size: 13px; font-weight: 600; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ti-chevron { font-size: 9px; opacity: 0.68; transition: transform 0.18s; }
        .ti-chevron.open { transform: rotate(180deg); }

        .ti-account-menu {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: white; border-radius: 14px; min-width: 210px;
          box-shadow: 0 12px 36px rgba(0,0,0,0.15); z-index: 1100;
          overflow: hidden; animation: dropIn 0.17s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ti-account-header { padding: 14px 16px 12px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; }
        .ti-acct-name  { font-size: 13px; font-weight: 700; color: #1a1a1a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ti-acct-email { font-size: 11px; color: #888; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .ti-menu-item {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px; color: #333; text-decoration: none;
          font-size: 13px; font-weight: 500; transition: background 0.13s;
          cursor: pointer; border: none; background: none; width: 100%; font-family: 'Inter', sans-serif;
        }
        .ti-menu-item:hover { background: #f6f6f6; }
        .ti-menu-item svg { color: #2CC275; font-size: 13px; flex-shrink: 0; }
        .ti-menu-item.danger { color: #d32f2f; }
        .ti-menu-item.danger svg { color: #d32f2f; }
        .ti-menu-divider { height: 1px; background: #f0f0f0; margin: 3px 0; }

        .ti-role-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; font-size: 12px; font-weight: 700;
          text-decoration: none; letter-spacing: 0.3px; transition: opacity 0.15s;
        }
        .ti-role-badge:hover { opacity: 0.82; }
        .ti-role-badge.admin     { color: #c62828; background: #fff5f5; }
        .ti-role-badge.organizer { color: #1565c0; background: #f0f5ff; }

        /* Mobile */
        .ti-hamburger { display: none; background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 6px; margin-left: auto; }
        .ti-mobile-menu {
          background: #1d8f50; border-top: 1px solid rgba(255,255,255,0.12);
          padding: 14px 18px; display: flex; flex-direction: column; gap: 2px;
        }
        .ti-mobile-link {
          color: white; text-decoration: none; font-size: 14px; font-weight: 500;
          padding: 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; gap: 9px; font-family: 'Inter', sans-serif;
        }
        .ti-mobile-search { display: flex; gap: 7px; margin-bottom: 8px; }
        .ti-mobile-search input {
          flex: 1; background: rgba(255,255,255,0.13); border: 1.5px solid rgba(255,255,255,0.26);
          border-radius: 8px; padding: 9px 13px; color: white; font-size: 14px;
          font-family: 'Inter', sans-serif; outline: none;
        }
        .ti-mobile-search input::placeholder { color: rgba(255,255,255,0.52); }
        .ti-mobile-search button {
          background: white; color: #1d8f50; border: none;
          border-radius: 8px; padding: 9px 15px; font-weight: 700; font-size: 13px;
          cursor: pointer; font-family: 'Inter', sans-serif;
        }

        @media (max-width: 900px) { .ti-search-outer { max-width: 300px; } }
        @media (max-width: 768px) {
          .ti-topbar { padding: 0 14px; }
          .ti-search-outer, .ti-nav-actions { display: none !important; }
          .ti-hamburger { display: flex; }
        }
        @media (min-width: 769px) {
          .ti-hamburger, .ti-mobile-menu { display: none !important; }
        }
      `}</style>

      <nav className="ti-navbar">
        <div className="ti-topbar">

          {/* Logo — full white, single color */}
          <Link to="/" className="ti-logo">TiTicket</Link>

          {/* Search + filter dropdown */}
          <div className="ti-search-outer" ref={searchWrapRef}>
            <form
              className={`ti-search-bar${showSearchPanel ? ' open' : ''}`}
              onSubmit={handleSearch}
            >
              <span className="ti-search-icon"><FaSearch /></span>
              <input
                className="ti-search-input"
                type="text"
                placeholder="Bạn tìm gì hôm nay?"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchPanel(true)}
                id="navbar-search-input"
                autoComplete="off"
              />
              <button type="submit" className="ti-search-submit">Tìm kiếm</button>
            </form>

            {/* Filter dropdown */}
            {showSearchPanel && (
              <div className="ti-search-panel" id="navbar-search-panel">

                <div className="ti-panel-label"><FaMapMarkerAlt /> Vị trí</div>
                <div className="ti-radio-group">
                  {LOCATIONS.map(loc => (
                    <label
                      key={loc.value}
                      className={`ti-radio-pill${selectedLocation === loc.value ? ' selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="nav-location"
                        value={loc.value}
                        checked={selectedLocation === loc.value}
                        onChange={() => setSelectedLocation(loc.value)}
                      />
                      {loc.label}
                    </label>
                  ))}
                </div>

                <div className="ti-panel-divider" />

                <div className="ti-panel-label"><FaSlidersH /> Thể loại</div>
                <div className="ti-cat-chips">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`ti-cat-chip${selectedCategories.includes(String(cat.id)) ? ' selected' : ''}`}
                      onClick={() => toggleCategory(String(cat.id))}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="ti-panel-actions">
                  <button type="button" className="ti-btn-reset" onClick={handleReset}>Thiết lập lại</button>
                  <button type="button" className="ti-btn-apply" onClick={handleApply}>Áp dụng</button>
                </div>
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="ti-nav-actions">
            {user ? (
              <>
                <Link to="/my-tickets" className="ti-nav-btn">
                  <FaTicketAlt /><span>Vé của tôi</span>
                </Link>

                {user.role === 'admin' && (
                  <Link to="/admin" className="ti-nav-btn ti-nav-btn-solid" style={{ color: '#c62828' }}>
                    <FaUserShield /><span>Quản trị</span>
                  </Link>
                )}
                {user.role === 'organizer' && (
                  <Link to="/organizer" className="ti-nav-btn ti-nav-btn-solid" style={{ color: '#1565c0' }}>
                    <FaTachometerAlt /><span>Dashboard</span>
                  </Link>
                )}

                <div className="ti-account-wrap" ref={accountRef}>
                  <button
                    className="ti-account-btn"
                    onClick={() => setShowAccountMenu(p => !p)}
                    id="navbar-account-btn"
                    aria-expanded={showAccountMenu}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="avatar"
                        style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.32)' }}
                        onError={e => e.target.style.display = 'none'}
                      />
                    ) : (
                      <AvatarPlaceholder name={displayName} size={30} />
                    )}
                    <span className="ti-account-name">{displayName}</span>
                    <FaChevronDown className={`ti-chevron${showAccountMenu ? ' open' : ''}`} />
                  </button>

                  {showAccountMenu && (
                    <div className="ti-account-menu" id="navbar-account-menu">
                      <div className="ti-account-header">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="avatar"
                            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }}
                            onError={e => e.target.style.display = 'none'}
                          />
                        ) : (
                          <AvatarPlaceholder name={displayName} size={38} />
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <div className="ti-acct-name">{displayName}</div>
                          <div className="ti-acct-email">{user.email}</div>
                        </div>
                      </div>

                      <Link to="/account" className="ti-menu-item" onClick={() => setShowAccountMenu(false)}>
                        <FaUser /> Thông tin tài khoản
                      </Link>
                      <Link to="/my-tickets" className="ti-menu-item" onClick={() => setShowAccountMenu(false)}>
                        <FaTicketAlt /> Vé của tôi
                      </Link>

                      {user.role === 'admin' && (
                        <>
                          <div className="ti-menu-divider" />
                          <Link to="/admin" className="ti-role-badge admin" onClick={() => setShowAccountMenu(false)}>
                            <FaUserShield /> QUẢN TRỊ HỆ THỐNG
                          </Link>
                        </>
                      )}
                      {user.role === 'organizer' && (
                        <>
                          <div className="ti-menu-divider" />
                          <Link to="/organizer" className="ti-role-badge organizer" onClick={() => setShowAccountMenu(false)}>
                            <FaTachometerAlt /> DASHBOARD
                          </Link>
                        </>
                      )}
                      {user.role === 'customer' && (
                        <>
                          <div className="ti-menu-divider" />
                          <Link to="/become-partner" className="ti-menu-item" onClick={() => setShowAccountMenu(false)}>
                            <FaUser /> Trở thành đối tác
                          </Link>
                        </>
                      )}

                      <div className="ti-menu-divider" />
                      <button className="ti-menu-item danger" onClick={handleLogout} id="navbar-logout-btn">
                        <FaSignOutAlt /> Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login"    className="ti-nav-btn">Đăng nhập</Link>
                <Link to="/register" className="ti-nav-btn ti-nav-btn-solid">Đăng ký</Link>
              </>
            )}
          </div>

          <button
            className="ti-hamburger"
            onClick={() => setIsMobileMenuOpen(p => !p)}
            aria-label="Mở menu"
            id="navbar-hamburger"
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="ti-mobile-menu" id="navbar-mobile-menu">
            <form className="ti-mobile-search" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Tìm kiếm sự kiện..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit">Tìm</button>
            </form>

            <Link to="/" className="ti-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Trang chủ</Link>

            {user ? (
              <>
                <Link to="/account" className="ti-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                  <FaUser /> Thông tin tài khoản
                </Link>
                <Link to="/my-tickets" className="ti-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                  <FaTicketAlt /> Vé của tôi
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="ti-mobile-link" style={{ color: '#ffcdd2' }} onClick={() => setIsMobileMenuOpen(false)}>
                    <FaUserShield /> QUẢN TRỊ
                  </Link>
                )}
                {user.role === 'organizer' && (
                  <Link to="/organizer" className="ti-mobile-link" style={{ color: '#bbdefb' }} onClick={() => setIsMobileMenuOpen(false)}>
                    <FaTachometerAlt /> DASHBOARD
                  </Link>
                )}
                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="ti-mobile-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffcdd2', textAlign: 'left' }}
                >
                  <FaSignOutAlt /> Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login"    className="ti-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Đăng nhập</Link>
                <Link to="/register" className="ti-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Đăng ký</Link>
              </>
            )}
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;