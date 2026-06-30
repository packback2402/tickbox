import React, { useState } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // KIỂM TRA
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/auth/register', {
        email,
        password
      });
      alert("Đăng ký thành công! Hãy đăng nhập.");
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.msg || "Đăng ký thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#121212'
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #333'
      }}>
        <h2 style={{ textAlign: 'center', color: '#2CC275', marginBottom: '10px', fontSize: '28px', fontWeight: 'bold' }}>
          Đăng ký tài khoản
        </h2>
        <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>
          Tạo tài khoản để mua vé ngay
        </p>

        {/* Hiển thị thông báo lỗi nếu có */}
        {error && (
          <div style={{
            background: 'rgba(255, 0, 0, 0.1)',
            color: '#ff4d4f',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center',
            border: '1px solid #ff4d4f'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>Email</label>
            <input
              type="email"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>Mật khẩu</label>
            <input
              type="password"
              placeholder="Ít nhất 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '14px' }}>Nhập lại mật khẩu</label>
            <input
              type="password"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: 'white', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '10px', padding: '14px', background: isLoading ? '#555' : '#2CC275', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'background 0.3s'
            }}
          >
            {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
        </form>

        <p style={{ marginTop: '25px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
          Đã có tài khoản? <Link to="/login" style={{ color: '#2CC275', textDecoration: 'none', fontWeight: 'bold' }}>Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;