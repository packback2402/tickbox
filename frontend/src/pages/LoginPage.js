import React, { useState } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        email,
        password
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      alert("Đăng nhập thành công!");
      navigate('/');
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.msg || "Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <div style={{ backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px', border: '1px solid #333' }}>
        <h2 style={{ textAlign: 'center', color: '#2CC275', marginBottom: '30px', fontSize: '28px', fontWeight: 'bold' }}>
          Đăng nhập
        </h2>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>Email</label>
            <input type="email" placeholder="Nhập email của bạn" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>Mật khẩu</label>
            <input type="password" placeholder="Nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />

            {/* LINK QUÊN MẬT KHẨU */}
            <div style={{ textAlign: 'right', marginTop: '10px' }}>
              <Link to="/forgot-password" style={{ color: '#2CC275', textDecoration: 'none', fontSize: '13px' }}>
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button type="submit" disabled={isLoading} style={{ marginTop: '10px', padding: '14px', background: isLoading ? '#555' : '#2CC275', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'background 0.3s' }}>
            {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <p style={{ marginTop: '25px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
          Chưa có tài khoản? <Link to="/register" style={{ color: '#2CC275', textDecoration: 'none', fontWeight: 'bold' }}>Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;