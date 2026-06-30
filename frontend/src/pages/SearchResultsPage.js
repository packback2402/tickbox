import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { FaCalendar, FaMapMarkerAlt, FaSearch, FaInbox } from 'react-icons/fa';

// Map location values to Vietnamese display labels
const LOCATION_LABELS = {
  'Ho Chi Minh': 'Hồ Chí Minh',
  'Ha Noi':      'Hà Nội',
  'Da Nang':     'Đà Nẵng',
  'Da Lat':      'Đà Lạt',
  'other':       'Vị trí khác',
};

const SearchResultsPage = () => {
  const [searchParams] = useSearchParams();
  const q         = searchParams.get('q')        || '';
  const location  = searchParams.get('location') || '';
  const catParams = searchParams.getAll('cat');

  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [categories, setCategories] = useState([]);  // { id, name }

  // Fetch category list to resolve IDs -> names
  useEffect(() => {
    api.get('/api/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q)        params.set('q', q);
      if (location) params.set('location', location);
      catParams.forEach(c => params.append('cat', c));
      const res = await api.get(`/api/events/search?${params.toString()}`);
      setEvents(res.data);
    } catch (err) {
      setError('Không thể tải kết quả tìm kiếm.');
    } finally {
      setLoading(false);
    }
  }, [q, location, catParams.join(',')]); // eslint-disable-line

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const buildLabel = () => {
    const parts = [];
    if (q) parts.push(`"${q}"`);
    if (location) {
      const locLabel = LOCATION_LABELS[location] || location;
      parts.push(`vị trí: ${locLabel}`);
    }
    if (catParams.length) {
      // Map IDs to category names
      const names = catParams.map(id => {
        const cat = categories.find(c => String(c.id) === String(id));
        return cat ? cat.name : id;
      });
      parts.push(`thể loại: ${names.join(', ')}`);
    }
    return parts.length ? parts.join(' · ') : 'Tất cả sự kiện';
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 40, paddingBottom: 60 }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <FaSearch style={{ color: 'var(--primary-color)', fontSize: 18 }} />
            <h1 style={{ fontSize: 'clamp(20px,4vw,28px)', color: '#fff', margin: 0 }}>
              Kết quả tìm kiếm
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            {buildLabel()} · <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{events.length} sự kiện</span>
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 16 }}>Đang tìm kiếm...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: 80, color: '#ff4d4f', fontSize: 16 }}>
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && events.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <FaInbox style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 17, marginBottom: 8 }}>
              Không tìm thấy sự kiện phù hợp
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Thử thay đổi từ khóa hoặc bộ lọc của bạn
            </p>
          </div>
        )}

        {/* Results grid */}
        {!loading && !error && events.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {events.map(event => {
              const isEnded = new Date(event.end_date || event.event_date) < new Date();
              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      background: 'var(--card-bg)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex', flexDirection: 'column',
                      height: '100%', transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    {/* Image */}
                    <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                      {isEnded && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
                        }}>
                          <span style={{ color: 'white', background: '#e74c3c', padding: '5px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                            ĐÃ KẾT THÚC
                          </span>
                        </div>
                      )}
                      {event.category_name && (
                        <div style={{
                          position: 'absolute', top: 10, left: 10, zIndex: 6,
                          background: 'rgba(0,0,0,0.65)', color: 'white',
                          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        }}>
                          {event.category_name}
                        </div>
                      )}
                      <img
                        src={event.image_url || 'https://via.placeholder.com/300x180?text=No+Image'}
                        alt={event.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => e.target.src = 'https://via.placeholder.com/300x180?text=No+Image'}
                      />
                    </div>

                    {/* Content */}
                    <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <h3 style={{
                        margin: 0, fontSize: 15, fontWeight: 700, color: '#fff',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', lineHeight: 1.4,
                      }}>
                        {event.title}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: 12 }}>
                        <FaCalendar style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                        {new Date(event.event_date).toLocaleDateString('vi-VN')}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: 12 }}>
                        <FaMapMarkerAlt style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.location}
                        </span>
                      </div>

                      <button style={{
                        marginTop: 'auto',
                        background: isEnded ? '#555' : 'var(--primary-color)',
                        color: isEnded ? '#aaa' : 'white',
                        border: 'none', borderRadius: 8,
                        padding: '9px 14px', fontWeight: 600, fontSize: 13,
                        cursor: isEnded ? 'default' : 'pointer',
                        width: '100%', transition: 'var(--transition)',
                      }}
                        onMouseEnter={e => { if (!isEnded) e.target.style.background = '#25a562'; }}
                        onMouseLeave={e => { if (!isEnded) e.target.style.background = 'var(--primary-color)'; }}
                        onClick={e => { if (isEnded) e.preventDefault(); }}
                      >
                        {isEnded ? 'Đã kết thúc' : 'Xem chi tiết'}
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultsPage;
