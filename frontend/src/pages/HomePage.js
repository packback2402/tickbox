import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import HeroBanner from '../components/HeroBanner';
import Slider from "react-slick"; 
import { FaCalendar } from "react-icons/fa";
import { MdPlace } from "react-icons/md";

const EventRow = ({ title, events }) => {
  const settings = {
    dots: true,
    infinite: false,  
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 4,
    responsive: [
      { breakpoint: 1400, settings: { slidesToShow: 3, slidesToScroll: 3 } },
      { breakpoint: 1024, settings: { slidesToShow: 2, slidesToScroll: 2 } },
      { breakpoint: 768, settings: { slidesToShow: 2, slidesToScroll: 1 } },
      { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1 } }
    ]
  };

  return (
    <section style={{ marginBottom: 'clamp(40px, 8vw, 60px)' }}>
      <h2 style={{ marginBottom: '24px', fontSize: 'clamp(20px, 4vw, 28px)', paddingLeft: '16px', color: '#fff', fontWeight: '600' }}>{title}</h2>
      {events.length === 0 ? (
        <p style={{ paddingLeft: '16px', color: 'var(--text-secondary)', fontSize: '16px' }}>Chưa có sự kiện nào.</p>
      ) : (
        <Slider {...settings}>
          {events.map(event => (
            <div key={event.id} style={{ padding: '8px' }}>
              <Link to={`/events/${event.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ 
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
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 'var(--shadow-lg)',
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}>
                  {/* Ảnh sự kiện */}
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
                  
                  {/* Nội dung card */}
                  <div style={{ 
                    padding: '16px',
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    {/* Tiêu đề */}
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
                      
                      {/* Thời gian */}
                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', gap: '8px' }}>
                        <FaCalendar style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                        <span>{new Date(event.event_date).toLocaleDateString('vi-VN')}</span>
                      </div>
                      
                      {/* Địa điểm */}
                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                        <MdPlace style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.location}
                        </span>
                      </div>
                    </div>
                    
                    {/* Category & Button */}
                    <div>
                      {event.category_name && (
                        <p style={{ 
                          fontWeight: '600', 
                          color: 'var(--primary-color)', 
                          margin: '0 0 12px 0',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {event.category_name}
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
            </div>
          ))}
        </Slider>
      )}
    </section>
  );
};

const HomePage = () => {
  const [featuredEvents, setFeaturedEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [featuredRes, upcomingRes, categoriesRes] = await Promise.all([
          axios.get('http://127.0.0.1:5000/api/events/featured'),
          axios.get('http://127.0.0.1:5000/api/events/upcoming'),
          axios.get('http://127.0.0.1:5000/api/categories')
        ]);
        
        setFeaturedEvents(featuredRes.data);
        setUpcomingEvents(upcomingRes.data);
        setCategories(categoriesRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu trang chủ:", err);
        setError("Không thể tải dữ liệu trang chủ.");
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '60px', padding: '20px' }}>
      <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>Đang tải trang...</div>
    </div>
  );
  if (error) return (
    <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '60px', padding: '20px', fontSize: '18px' }}>
      {error}
    </div>
  );

  return (
    <div style={{ paddingTop: '40px', paddingBottom: '60px', minHeight: '100vh' }}>
      <div className="container">
        <HeroBanner event={featuredEvents.length > 0 ? featuredEvents[0] : null} />
        
        <EventRow title="Sự kiện nổi bật" events={featuredEvents.slice(1)} />
        <EventRow title="Sự kiện sắp diễn ra" events={upcomingEvents} />

        {/* Categories Section */}
        <section style={{ marginTop: '60px' }}>
          <h2 style={{ marginBottom: '24px', fontSize: 'clamp(20px, 4vw, 28px)', paddingLeft: '16px', color: '#fff', fontWeight: '600' }}>Khám phá</h2>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}>
            {categories.map(category => (
              <Link key={category.id} to={`/category/${category.id}`} style={{
                background: 'var(--card-bg)',
                padding: '14px 20px',
                borderRadius: '10px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontWeight: '500',
                border: '2px solid var(--border-color)',
                transition: 'var(--transition)',
                textAlign: 'center',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.background = 'rgba(44, 194, 117, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--card-bg)';
              }}>
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;