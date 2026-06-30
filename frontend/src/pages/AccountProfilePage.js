import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  FaUser, FaPhone, FaEnvelope, FaBirthdayCake,
  FaVenusMars, FaSave, FaArrowLeft, FaCheckCircle
} from 'react-icons/fa';

// Avatar preview component
const AvatarPreview = ({ url, name, size = 100 }) => {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt="Avatar"
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '3px solid var(--primary-color)', background: '#1e1e1e',
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2CC275, #1a7a48)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size * 0.34,
      border: '3px solid var(--primary-color)', letterSpacing: 1,
    }}>
      {initials}
    </div>
  );
};

// Field wrapper
const FormField = ({ label, icon, children, hint }) => (
  <div style={{ marginBottom: 22 }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>
      {icon} {label}
    </label>
    {children}
    {hint && <p style={{ color: '#666', fontSize: 12, marginTop: 5, margin: '5px 0 0' }}>{hint}</p>}
  </div>
);

// Shared input styles
const inputStyle = {
  width: '100%',
  background: '#2a2a2a',
  border: '1.5px solid #333',
  borderRadius: 10,
  color: '#fff',
  padding: '12px 16px',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const AccountProfilePage = () => {
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    avatar_url: '',
    date_of_birth: '',
    gender: '',
    email: '',
  });
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]         = useState(false);
  const [success,       setSuccess]        = useState(false);
  const [error,         setError]          = useState(null);
  const [focusedField,  setFocusedField]   = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError,   setAvatarError]    = useState('');
  const [avatarHover,   setAvatarHover]    = useState(false);

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    api.get('/api/user/profile')
      .then(res => {
        const u = res.data;
        setForm({
          full_name:     u.full_name     || '',
          phone:         u.phone         || '',
          avatar_url:    u.avatar_url    || '',
          date_of_birth: u.date_of_birth ? u.date_of_birth.split('T')[0] : '',
          gender:        u.gender        || '',
          email:         u.email         || '',
        });
      })
      .catch(() => { setError('Không thể tải thông tin tài khoản.'); })
      .finally(() => setLoading(false));
  }, [navigate]);

  // Avatar upload handler
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ALLOWED = ['image/jpeg','image/png','image/webp','image/gif'];
    if (!ALLOWED.includes(file.type)) {
      setAvatarError('Chỉ chấp nhận JPG, PNG, WEBP, GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Ảnh không được vượt quá 5MB.');
      return;
    }

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, avatar_url: localUrl }));
    setAvatarError('');
    setAvatarUploading(true);

    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/api/upload/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const serverUrl = res.data.url;
      setForm(prev => ({ ...prev, avatar_url: serverUrl }));
    } catch (err) {
      setAvatarError(err.response?.data?.msg || 'Upload thất bại.');
      setForm(prev => ({ ...prev, avatar_url: '' }));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await api.put('/api/user/profile', {
        full_name:     form.full_name     || null,
        phone:         form.phone         || null,
        avatar_url:    form.avatar_url    || null,
        date_of_birth: form.date_of_birth || null,
        gender:        form.gender        || null,
      });

      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = {
        ...storedUser,
        full_name:  res.data.user.full_name,
        avatar_url: res.data.user.avatar_url,
        phone:      res.data.user.phone,
        date_of_birth: res.data.user.date_of_birth,
        gender:     res.data.user.gender,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('storage'));

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      setError(err.response?.data?.msg || 'Lưu thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const getInputStyle = (field) => ({
    ...inputStyle,
    borderColor: focusedField === field ? 'var(--primary-color)' : '#333',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(44,194,117,0.12)' : 'none',
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
      Đang tải...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px 60px', background: 'var(--dark-bg)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .profile-page * { font-family: 'Inter', sans-serif; }
        .profile-page select option { background: #2a2a2a; color: #fff; }
        .ti-input:focus { border-color: var(--primary-color) !important; box-shadow: 0 0 0 3px rgba(44,194,117,0.12) !important; }
        .save-btn:hover { background: #25a562 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(44,194,117,0.35) !important; }
        .save-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none !important; }
      `}</style>

      <div className="profile-page" style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 14, marginBottom: 28, padding: '4px 0',
            fontFamily: 'inherit', transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          id="profile-back-btn"
        >
          <FaArrowLeft /> Quay lại
        </button>

        {/* Card */}
        <div style={{
          background: '#1a1a1a',
          borderRadius: 20,
          border: '1px solid #2a2a2a',
          /* overflow: hidden removed — header handles its own radius */
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #2CC275 0%, #1a7a48 100%)',
            padding: '32px 32px 64px',
            position: 'relative',
            borderRadius: '20px 20px 0 0',
            overflow: 'hidden',
          }}>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>
              Thông tin tài khoản
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Quản lý thông tin cá nhân của bạn
            </p>
          </div>

          {/* ── Avatar circle ONLY ── overlaps the green header */}
          <div style={{ padding: '0 28px', marginTop: -48, marginBottom: 0 }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => !avatarUploading && avatarInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && avatarInputRef.current?.click()}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              title="Nhấn để thay ảnh đại diện"
              style={{
                position: 'relative',
                width: 88, height: 88,
                borderRadius: '50%',
                cursor: avatarUploading ? 'default' : 'pointer',
                display: 'inline-block',
                boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
                border: '3.5px solid #1a1a1a',
                overflow: 'hidden',
                outline: 'none',
              }}
            >
              <AvatarPreview
                url={form.avatar_url
                  ? (form.avatar_url.startsWith('http') || form.avatar_url.startsWith('blob')
                      ? form.avatar_url
                      : `http://localhost:5001${form.avatar_url}`)
                  : ''}
                name={form.full_name || form.email}
                size={82}
              />

              {/* Spinner */}
              {avatarUploading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 26, height: 26,
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#2CC275',
                    borderRadius: '50%',
                    animation: 'profile-spin 0.7s linear infinite',
                  }} />
                </div>
              )}

              {/* Hover camera overlay */}
              {!avatarUploading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: avatarHover ? 'rgba(0,0,0,0.52)' : 'rgba(0,0,0,0)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  transition: 'background 0.2s',
                  pointerEvents: 'none',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ opacity: avatarHover ? 1 : 0, transition: 'opacity 0.2s' }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span style={{
                    color: 'white', fontSize: 9, fontWeight: 700,
                    opacity: avatarHover ? 1 : 0, transition: 'opacity 0.2s', letterSpacing: 0.3,
                  }}>THAY ẢNH</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Tên + email ── hoàn toàn trong vùng tối, không bị overlap */}
          <div style={{ padding: '10px 28px 0' }}>
            <div style={{
              color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {form.full_name || <span style={{ color: '#555', fontWeight: 400, fontSize: 14 }}>Chưa có tên</span>}
            </div>
            <div style={{
              color: '#888', fontSize: 13, marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {form.email}
            </div>
          </div>

          {/* ── Upload conditions panel ── */}
          <div style={{ padding: '12px 28px 4px' }}>
            <div style={{
              background: '#252525',
              border: '1px solid #333',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ color: '#aaa', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Ảnh đại diện
                </div>
                <div style={{ color: '#555', fontSize: 11, lineHeight: 1.6 }}>
                  Định dạng: <span style={{ color: '#777' }}>JPG, PNG, WEBP, GIF</span>
                </div>
                <div style={{ color: '#555', fontSize: 11 }}>
                  Kích thước tối đa: <strong style={{ color: '#777' }}>5MB</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                style={{
                  background: avatarUploading ? '#2a2a2a' : 'rgba(44,194,117,0.12)',
                  border: `1.5px solid ${avatarUploading ? '#333' : 'rgba(44,194,117,0.4)'}`,
                  color: avatarUploading ? '#555' : '#2CC275',
                  borderRadius: 8, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600,
                  cursor: avatarUploading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!avatarUploading) e.currentTarget.style.background = 'rgba(44,194,117,0.22)'; }}
                onMouseLeave={e => { if (!avatarUploading) e.currentTarget.style.background = 'rgba(44,194,117,0.12)'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                {avatarUploading ? 'Đang tải lên...' : 'Chọn ảnh'}
              </button>
            </div>

            {/* Avatar error */}
            {avatarError && (
              <div style={{
                marginTop: 8, padding: '8px 13px', borderRadius: 8,
                background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)',
                color: '#ff6b6b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {avatarError}
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleAvatarFileChange}
          />

          <style>{`@keyframes profile-spin { to { transform: rotate(360deg); } }`}</style>


          {/* Form */}
          <form onSubmit={handleSave} style={{ padding: '8px 32px 32px' }}>


            {/* Full name */}
            <FormField label="Họ và tên" icon={<FaUser style={{ color: 'var(--primary-color)' }} />}>
              <input
                name="full_name"
                type="text"
                placeholder="Nhập họ và tên đầy đủ"
                value={form.full_name}
                onChange={handleChange}
                onFocus={() => setFocusedField('full_name')}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle('full_name')}
                id="profile-full-name"
              />
            </FormField>

            {/* Phone */}
            <FormField label="Số điện thoại" icon={<FaPhone style={{ color: 'var(--primary-color)' }} />}>
              <input
                name="phone"
                type="tel"
                placeholder="0912 345 678"
                value={form.phone}
                onChange={handleChange}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle('phone')}
                id="profile-phone"
              />
            </FormField>

            {/* Email (read-only) */}
            <FormField
              label="Email"
              icon={<FaEnvelope style={{ color: 'var(--primary-color)' }} />}
              hint="Email không thể thay đổi"
            >
              <input
                type="email"
                value={form.email}
                readOnly
                style={{ ...inputStyle, background: '#222', color: '#888', cursor: 'not-allowed', borderColor: '#2a2a2a' }}
                id="profile-email"
              />
            </FormField>

            {/* Date of birth */}
            <FormField label="Ngày tháng năm sinh" icon={<FaBirthdayCake style={{ color: 'var(--primary-color)' }} />}>
              <input
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
                onFocus={() => setFocusedField('date_of_birth')}
                onBlur={() => setFocusedField(null)}
                style={{
                  ...getInputStyle('date_of_birth'),
                  colorScheme: 'dark',
                }}
                max={new Date().toISOString().split('T')[0]}
                id="profile-dob"
              />
            </FormField>

            {/* Gender */}
            <FormField label="Giới tính" icon={<FaVenusMars style={{ color: 'var(--primary-color)' }} />}>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                onFocus={() => setFocusedField('gender')}
                onBlur={() => setFocusedField(null)}
                style={{
                  ...getInputStyle('gender'),
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23aaa' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                  paddingRight: 36,
                }}
                id="profile-gender"
              >
                <option value="">-- Chọn giới tính --</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </FormField>

            {/* Messages */}
            {error && (
              <div style={{
                background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 18,
                color: '#ff6b6b', fontSize: 14,
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'rgba(44,194,117,0.12)', border: '1px solid rgba(44,194,117,0.35)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 18,
                color: '#2CC275', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <FaCheckCircle /> Lưu thông tin thành công!
              </div>
            )}

            {/* Save button */}
            <button
              type="submit"
              className="save-btn"
              disabled={saving}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: 'var(--primary-color)', color: 'white',
                border: 'none', fontWeight: 700, fontSize: 15,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                transition: 'all 0.22s', fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(44,194,117,0.25)',
              }}
              id="profile-save-btn"
            >
              {saving ? (
                <>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Đang lưu...
                </>
              ) : (
                <><FaSave /> Lưu thay đổi</>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AccountProfilePage;
