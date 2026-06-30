import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import ScheduleTicketManager from '../components/ScheduleTicketManager';
import { FaArrowLeft, FaTicketAlt, FaChartBar, FaCalendarAlt, FaMapMarkerAlt, FaClock } from 'react-icons/fa';

const AdminEventManagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'allocate';

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Guard: chỉ admin mới vào được
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user || user.role !== 'admin') {
      alert('Bạn không có quyền truy cập!');
      navigate('/');
      return;
    }
    fetchEvent();
  }, [id]); // eslint-disable-line

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/api/events/${id}`);
      setEvent(res.data);
    } catch (err) {
      console.error('Lỗi tải sự kiện:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#2CC275', fontSize: 16 }}>Đang tải...</div>
    </div>
  );

  if (!event) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#ff6b6b', fontSize: 16 }}>Không tìm thấy sự kiện #{id}</div>
    </div>
  );

  const tabStyle = (id) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 10, cursor: 'pointer', border: 'none',
    fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s',
    background: activeTab === id ? '#2CC27520' : 'transparent',
    color: activeTab === id ? '#2CC275' : '#666',
    borderBottom: activeTab === id ? '2px solid #2CC275' : '2px solid transparent',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Back button */}
          <button
            onClick={() => navigate('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 14, padding: 0, fontFamily: 'inherit' }}
          >
            <FaArrowLeft size={12} /> Quay lại Admin
          </button>

          {/* Event info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <img
              src={event.image_url?.startsWith('http') ? event.image_url : `http://localhost:5001${event.image_url}`}
              alt={event.title}
              onError={e => e.target.src = 'https://via.placeholder.com/64x64/1a1a1a/333?text=?'}
              style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #222' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ background: '#2CC27520', color: '#2CC275', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: '1px solid #2CC27540', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Admin
                </span>
                <span style={{ background: event.status === 'published' ? '#2CC27520' : '#FFC10720', color: event.status === 'published' ? '#2CC275' : '#FFC107', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                  {event.status === 'published' ? 'Đã đăng' : event.status === 'pending' ? 'Chờ duyệt' : event.status}
                </span>
              </div>
              <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.3 }}>{event.title}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', color: '#555', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FaClock size={10} style={{ color: '#2CC275' }} />
                  {new Date(event.event_date).toLocaleString('vi-VN')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FaMapMarkerAlt size={10} style={{ color: '#2CC275' }} />
                  {event.location}
                </span>
                {event.organizer && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FaCalendarAlt size={10} style={{ color: '#2CC275' }} />
                    {event.organizer}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid #1e1e1e' }}>
            <button style={tabStyle('allocate')} onClick={() => setActiveTab('allocate')}>
              <FaTicketAlt size={12} /> Phân bổ vé
            </button>
            <button style={tabStyle('analytics')} onClick={() => setActiveTab('analytics')}>
              <FaChartBar size={12} /> Phân tích
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px' }}>
        {activeTab === 'allocate' && (
          <ScheduleTicketManager
            event={event}
            onClose={() => navigate('/admin')}
            onSuccess={() => {}}
          />
        )}

        {activeTab === 'analytics' && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <FaChartBar size={48} color="#2CC275" style={{ marginBottom: 16, opacity: 0.6 }} />
            <p style={{ color: '#888', marginBottom: 20 }}>Xem báo cáo thống kê chi tiết cho sự kiện này</p>
            <button
              onClick={() => navigate(`/organizer/event/${id}/analytics`)}
              style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <FaChartBar size={14} /> Mở trang phân tích đầy đủ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEventManagePage;
