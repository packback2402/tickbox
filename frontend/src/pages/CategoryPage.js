import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FaCalendar, FaArrowLeft } from 'react-icons/fa';
import { MdPlace } from 'react-icons/md';

const CategoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategoryAndEvents = async () => {
      try {
        const [categoryRes, eventsRes] = await Promise.all([
          axios.get(`http://127.0.0.1:5000/api/categories/${id}`),
          axios.get(`http://127.0.0.1:5000/api/events?category_id=${id}`)
        ]);
        setCategory(categoryRes.data);
        setEvents(eventsRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu:', err);
        setError('Không thể tải dữ liệu thể loại.');
        setLoading(false);
      }
    };
    fetchCategoryAndEvents();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '60px', padding: '20px' }}>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>Đang tải trang...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '60px', padding: '20px', fontSize: '18px' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '40px', paddingBottom: '60px', minHeight: '100vh' }}>
      <div className="container">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '30px',
            padding: '8px 0',
            transition: 'var(--transition)',
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.8'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          <FaArrowLeft /> Quay lại
        </button>

        {/* Category Header */}
        <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '2px solid var(--border-color)' }}>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', color: '#fff', marginBottom: '12px', fontWeight: '700' }}>
            {category?.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0 }}>
            Tìm thấy {events.length} sự kiện
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-secondary)',
          }}>
            <p style={{ fontSize: '18px', marginBottom: '20px' }}>Chưa có sự kiện nào trong thể loại này.</p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                background: 'var(--primary-color)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => e.target.style.background = '#25a562'}
              onMouseLeave={(e) => e.target.style.background = 'var(--primary-color)'}
            >
              Quay về trang chủ
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            {events.map(event => (
              <Link key={event.id} to={`/events/${event.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '420px',
                    transition: 'var(--transition)',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                >
                  {/* Image */}
                  <div style={{ height: '200px', overflow: 'hidden', position: 'relative' }}>
                    {event.is_featured && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'var(--primary-color)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        zIndex: 10,
                      }}>
                        Nổi bật
                      </div>
                    )}
                    {event.category_name && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        zIndex: 10,
                      }}>
                        {event.category_name}
                      </div>
                    )}
                    <img
                      src={event.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}
                      alt={event.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'var(--transition)',
                      }}
                      onError={(e) => e.target.src = 'https://via.placeholder.com/300x200?text=No+Image'}
                    />
                  </div>

                  {/* Content */}
                  <div style={{
                    padding: '16px',
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div>
                      <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: 'clamp(16px, 3vw, 18px)',
                        height: '48px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        color: '#fff',
                        fontWeight: '600',
                        lineHeight: '1.4'
                      }}>
                        {event.title}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', gap: '8px' }}>
                        <FaCalendar style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                        <span>{new Date(event.event_date).toLocaleDateString('vi-VN')}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                        <MdPlace style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.location}
                        </span>
                      </div>
                    </div>

                    <div>
                      {event.organizer && (
                        <p style={{
                          fontWeight: '600',
                          color: 'var(--primary-color)',
                          margin: '0 0 12px 0',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {event.organizer}
                        </p>
                      )}

                      <button style={{
                        width: '100%',
                        textAlign: 'center',
                        background: 'var(--primary-color)',
                        color: 'white',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'var(--transition)',
                      }}
                        onMouseEnter={(e) => e.target.style.background = '#25a562'}
                        onMouseLeave={(e) => e.target.style.background = 'var(--primary-color)'}
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
