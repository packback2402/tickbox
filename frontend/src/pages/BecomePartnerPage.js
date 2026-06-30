import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { FaHandshake, FaBuilding, FaPhone, FaEnvelope, FaComment, FaCheckCircle, FaClock } from 'react-icons/fa';

const BecomePartnerPage = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const [formData, setFormData] = useState({ org_name: '', phone: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // null, 'pending', 'approved', 'rejected', 'none'
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role === 'organizer') {
      navigate('/organizer');
      return;
    }
    if (user.role === 'admin') {
      navigate('/admin');
      return;
    }
    // Check existing request
    const checkStatus = async () => {
      try {
        const res = await api.get('/api/organizer-requests/my-status');
        setRequestStatus(res.data.status || 'none');
      } catch (err) {
        setRequestStatus('none');
      } finally {
        setChecking(false);
      }
    };
    checkStatus();
  }, []); // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.org_name.trim()) {
      alert("Vui lòng nhập tên tổ chức!");
      return;
    }
    if (!formData.phone.trim()) {
      alert("Vui lòng nhập số điện thoại!");
      return;
    }
    if (!formData.email.trim()) {
      alert("Vui lòng nhập email liên hệ!");
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/organizer-requests', formData);
      alert("Yêu cầu đã được gửi! Vui lòng chờ Admin xét duyệt.");
      setRequestStatus('pending');
    } catch (err) {
      alert(err.response?.data?.msg || "Có lỗi xảy ra!");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div style={{ textAlign: 'center', marginTop: '60px', color: '#aaa' }}>Đang kiểm tra...</div>;

  // Trạng thái đã gửi
  if (requestStatus === 'pending') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <div style={{ backgroundColor: '#1e1e1e', padding: '50px', borderRadius: '16px', maxWidth: '500px', textAlign: 'center', border: '1px solid #333', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <FaClock style={{ fontSize: '60px', color: '#FFC107', marginBottom: '20px' }} />
          <h2 style={{ color: '#FFC107', marginBottom: '16px' }}>Yêu cầu đang chờ duyệt</h2>
          <p style={{ color: '#aaa', lineHeight: '1.6', marginBottom: '30px' }}>
            Chúng tôi đã nhận được yêu cầu của bạn. Admin sẽ xem xét và phản hồi trong thời gian sớm nhất.
          </p>
          <Link to="/" style={{ color: '#2CC275', textDecoration: 'none', fontWeight: '600' }}>← Quay về trang chủ</Link>
        </div>
      </div>
    );
  }

  if (requestStatus === 'approved') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <div style={{ backgroundColor: '#1e1e1e', padding: '50px', borderRadius: '16px', maxWidth: '500px', textAlign: 'center', border: '1px solid #333' }}>
          <FaCheckCircle style={{ fontSize: '60px', color: '#2CC275', marginBottom: '20px' }} />
          <h2 style={{ color: '#2CC275', marginBottom: '16px' }}>Đã được phê duyệt!</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Tài khoản của bạn đã được nâng cấp. Vui lòng đăng nhập lại để sử dụng Dashboard.</p>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }} style={{ background: '#2CC275', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }}>
            Đăng nhập lại
          </button>
        </div>
      </div>
    );
  }

  if (requestStatus === 'rejected') {
    // Cho phép gửi lại → hiện lại form thay vì dead-end
    setRequestStatus('none');
  }

  // Form đăng ký
  const inputStyle = { width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212', padding: '40px 20px' }}>
      <div style={{ backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '100%', maxWidth: '500px', border: '1px solid #333' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <FaHandshake style={{ fontSize: '48px', color: '#2CC275', marginBottom: '12px' }} />
          <h2 style={{ color: '#2CC275', marginBottom: '8px', fontSize: '26px' }}>Trở thành Đối tác</h2>
          <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.5' }}>
            Đăng ký làm Nhà tổ chức sự kiện trên Ticketbox.<br />
            Yêu cầu sẽ được Admin xem xét và phê duyệt.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
              <FaBuilding /> Tên tổ chức / đơn vị <span style={{ color: 'red' }}>*</span>
            </label>
            <input style={inputStyle} required placeholder="VD: Công ty TNHH ABC Entertainment" value={formData.org_name} onChange={e => setFormData({ ...formData, org_name: e.target.value })} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
              <FaPhone /> Số điện thoại liên hệ <span style={{ color: 'red' }}>*</span>
            </label>
            <input style={inputStyle} type="tel" required placeholder="0912 345 678" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
              <FaEnvelope /> Email liên hệ <span style={{ color: 'red' }}>*</span>
            </label>
            <input style={inputStyle} type="email" required placeholder="contact@company.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>
              <FaComment /> Lời nhắn cho Admin
            </label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }} placeholder="Giới thiệu về tổ chức của bạn, loại sự kiện dự định tổ chức..." value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} />
          </div>

          <button type="submit" disabled={loading} style={{
            marginTop: '10px', padding: '14px', background: loading ? '#555' : '#2CC275',
            color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold', fontSize: '16px', transition: 'background 0.3s'
          }}>
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </form>

        <p style={{ marginTop: '25px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
          <Link to="/" style={{ color: '#aaa', textDecoration: 'none' }}>← Quay về trang chủ</Link>
        </p>
      </div>
    </div>
  );
};

export default BecomePartnerPage;
