import React, { useRef, useState, useCallback } from 'react';
import api from '../api';

/**
 * ImageUploader — Component upload ảnh trực tiếp (drag & drop hoặc click)
 *
 * Props:
 *   currentUrl  {string}   URL ảnh hiện tại (để hiển thị preview ban đầu)
 *   onUpload    {function} Callback nhận URL mới sau khi upload xong
 *   label       {string}   Nhãn hiển thị (mặc định: "Ảnh bìa")
 *   shape       {string}   'square' | 'circle' (mặc định: 'square')
 *   aspectRatio {number}   Tỷ lệ khung ảnh preview (mặc định: 16/9)
 *   required    {boolean}  Có bắt buộc chọn ảnh không
 *   theme       {string}   'dark' | 'light' (mặc định: 'dark')
 */
const ImageUploader = ({
  currentUrl   = '',
  onUpload,
  label        = 'Ảnh bìa',
  shape        = 'square',
  aspectRatio  = 16 / 9,
  required     = false,
  theme        = 'dark',
}) => {
  const inputRef              = useRef(null);
  const [preview,  setPreview]  = useState(currentUrl || '');
  const [uploading,setUploading]= useState(false);
  const [progress, setProgress] = useState(0);
  const [error,    setError]    = useState('');
  const [dragging, setDragging] = useState(false);

  /* ── Helpers ─────────────────────────────────────────────────── */
  const isDark    = theme === 'dark';
  const bg        = isDark ? '#1e1e1e' : '#f5f5f5';
  const border    = isDark ? '#333' : '#ddd';
  const textMain  = isDark ? '#ccc'  : '#444';
  const textSub   = isDark ? '#666'  : '#888';
  const primary   = '#2CC275';
  const radius    = shape === 'circle' ? '50%' : '12px';

  const BACKEND_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${BACKEND_BASE}${url}`;
  };

  /* ── Core upload logic ───────────────────────────────────────── */
  const doUpload = useCallback(async (file) => {
    if (!file) return;

    // Client-side validation
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 5MB.');
      return;
    }

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setError('');
    setUploading(true);
    setProgress(0);

    // Fake progress animation while uploading
    const fakeProgress = setInterval(() => {
      setProgress(p => (p < 85 ? p + 12 : p));
    }, 150);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/api/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(fakeProgress);
      setProgress(100);
      const serverUrl = res.data.url;
      setPreview(resolveUrl(serverUrl));
      onUpload && onUpload(serverUrl);
    } catch (err) {
      clearInterval(fakeProgress);
      setProgress(0);
      setPreview(currentUrl || '');
      setError(err.response?.data?.msg || 'Upload thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, onUpload]);

  /* ── Event handlers ──────────────────────────────────────────── */
  const handleFileChange = (e) => doUpload(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    doUpload(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleClear = (e) => {
    e.stopPropagation();
    setPreview('');
    setError('');
    onUpload && onUpload('');
    if (inputRef.current) inputRef.current.value = '';
  };

  /* ── Computed preview style ──────────────────────────────────── */
  const hasPreview = Boolean(preview);

  const containerStyle = {
    position: 'relative',
    width: '100%',
    ...(shape === 'circle'
      ? { width: 110, height: 110 }
      : { paddingBottom: `${(1 / aspectRatio) * 100}%` }
    ),
  };

  const innerStyle = shape === 'circle'
    ? {
        width: 110, height: 110,
        borderRadius: radius,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        border: dragging
          ? `2.5px dashed ${primary}`
          : `2.5px dashed ${hasPreview ? primary : border}`,
        background: bg,
        transition: 'all 0.2s',
        boxShadow: dragging ? `0 0 0 4px ${primary}25` : 'none',
      }
    : {
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        cursor: 'pointer',
        border: dragging
          ? `2px dashed ${primary}`
          : `2px dashed ${hasPreview ? primary : border}`,
        background: bg,
        transition: 'all 0.2s',
        boxShadow: dragging ? `0 0 0 4px ${primary}25` : 'none',
      };

  return (
    <div>
      {/* Label */}
      {label && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 7,
          color: textSub, fontSize: 13, fontWeight: 600,
          marginBottom: 10, letterSpacing: 0.2,
          textTransform: 'uppercase',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          {label}
          {required && <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>}
        </label>
      )}

      <div style={shape === 'circle' ? { display: 'flex', alignItems: 'flex-end', gap: 14 } : {}}>
        {/* Drop zone */}
        <div style={containerStyle}>
          <div
            style={innerStyle}
            onClick={() => !uploading && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
            aria-label="Vùng upload ảnh"
          >
            {/* Preview image */}
            {hasPreview && (
              <img
                src={preview}
                alt="preview"
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', display: 'block',
                }}
                onError={() => setPreview('')}
              />
            )}

            {/* Placeholder (no preview) */}
            {!hasPreview && !uploading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: 16,
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                {shape !== 'circle' && (
                  <>
                    <span style={{ color: textMain, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                      Kéo thả hoặc click để chọn ảnh
                    </span>
                    <span style={{ color: textSub, fontSize: 11 }}>
                      JPG, PNG, WEBP, GIF · Tối đa 5MB
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Uploading overlay */}
            {uploading && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36,
                  border: `3px solid rgba(255,255,255,0.25)`,
                  borderTopColor: primary,
                  borderRadius: '50%',
                  animation: 'imgup-spin 0.7s linear infinite',
                }} />
                <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>
                  Đang tải lên...
                </span>
              </div>
            )}

            {/* Hover overlay on existing preview */}
            {hasPreview && !uploading && (
              <div
                className="imgup-hover-overlay"
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                <div className="imgup-hover-icon" style={{
                  opacity: 0, transition: 'opacity 0.2s',
                  background: 'rgba(0,0,0,0.6)', borderRadius: 8,
                  padding: '8px 14px', color: 'white', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Thay ảnh
                </div>
              </div>
            )}

            {/* Clear button */}
            {hasPreview && !uploading && (
              <button
                type="button"
                onClick={handleClear}
                title="Xóa ảnh"
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.65)', border: '1.5px solid rgba(255,255,255,0.3)',
                  color: 'white', cursor: 'pointer', zIndex: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(229,57,53,0.85)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.65)'}
              >
                ✕
              </button>
            )}

            {/* Progress bar */}
            {progress > 0 && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 3, background: 'rgba(255,255,255,0.15)',
              }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: primary,
                  transition: 'width 0.15s ease',
                  borderRadius: '0 2px 2px 0',
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Circle mode: action buttons beside avatar */}
        {shape === 'circle' && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: isDark ? '#2a2a2a' : '#f0faf5',
                border: `1.5px solid ${isDark ? '#444' : '#b7e5cf'}`,
                color: primary, borderRadius: 8,
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', marginBottom: 8,
                fontFamily: 'inherit', width: '100%',
                opacity: uploading ? 0.65 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              {uploading ? 'Đang tải...' : (hasPreview ? 'Thay ảnh' : 'Chọn ảnh')}
            </button>
            <p style={{ color: textSub, fontSize: 11, margin: 0, lineHeight: 1.4 }}>
              JPG, PNG, WEBP, GIF<br/>Tối đa 5MB
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 8, padding: '9px 13px', borderRadius: 8,
          background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)',
          color: '#ff6b6b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* CSS */}
      <style>{`
        @keyframes imgup-spin { to { transform: rotate(360deg); } }
        [role="button"]:hover .imgup-hover-overlay { background: rgba(0,0,0,0.35) !important; }
        [role="button"]:hover .imgup-hover-icon    { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default ImageUploader;
