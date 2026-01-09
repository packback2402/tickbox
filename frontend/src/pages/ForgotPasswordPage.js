import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Giả lập gửi yêu cầu
    alert(`Một liên kết đặt lại mật khẩu đã được gửi tới ${email}. (Đây là tính năng giả lập)`);
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <div style={{ backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px', border: '1px solid #333' }}>
        <h2 style={{ textAlign: 'center', color: '#2CC275', marginBottom: '20px', fontSize: '26px', fontWeight: 'bold' }}>
          Quên mật khẩu?
        </h2>
        <p style={{ color: '#aaa', textAlign: 'center', marginBottom: '30px', fontSize: '14px' }}>
          Nhập email của bạn và chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input type="email" placeholder="Nhập email của bạn" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />

          <button type="submit" style={{ marginTop: '10px', padding: '14px', background: '#2CC275', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            Gửi yêu cầu
          </button>
        </form>

        <p style={{ marginTop: '25px', textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#aaa', textDecoration: 'none', fontSize: '14px' }}>← Quay lại Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;