import React from 'react';
import { Link } from 'react-router-dom';
import { FaCalendar } from "react-icons/fa"; // <-- 1. THÊM ICON
import { MdPlace } from "react-icons/md";   // <-- 1. THÊM ICON

const HeroBanner = ({ event }) => {
  if (!event) {
    // 2. SỬA NỀN BANNER RỖNG CHO DARK MODE
    return (
      <div style={{ 
        background: '#1e1e1e', // <-- SỬA NỀN
        height: '300px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: '40px', 
        borderRadius: '10px' 
      }}>
        <h2>Không có sự kiện nổi bật</h2>
      </div>
    );
  }

  // Nếu có sự kiện, hiển thị banner
  return (
    <div style={{
      height: '400px',
      borderRadius: '10px',
      marginBottom: '40px',
      position: 'relative',
      backgroundImage: `url(${event.image_url || 'https://via.placeholder.com/800x400?text=No+Image'})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      {/* Lớp phủ mờ */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(to right, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0) 100%)',
        borderRadius: '10px'
      }}></div>
      
      {/* Phần nội dung text */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        color: 'white',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 40px',
        maxWidth: '50%'
      }}>
        <h2 style={{ fontSize: '36px', margin: '0 0 10px 0' }}>{event.title}</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '16px', margin: '5px 0' }}>
          <FaCalendar style={{ marginRight: '8px', color: '#2CC275' }} />
          {new Date(event.event_date).toLocaleDateString('vi-VN')}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '16px', margin: '5px 0 25px 0' }}>
          <MdPlace style={{ marginRight: '8px', color: '#2CC275' }} />
          {event.location}
        </div>

        <Link 
          to={`/events/${event.id}`} 
          style={{
            background: '#2CC275',
            color: 'white',
            padding: '12px 25px',
            borderRadius: '5px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '16px',
            maxWidth: '200px',
            textAlign: 'center'
        }}>
          Mua vé ngay
        </Link>
      </div>
    </div>
  );
};

export default HeroBanner;