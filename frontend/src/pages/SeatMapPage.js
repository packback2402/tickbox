import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { FaArrowLeft, FaChair, FaClock, FaCircleCheck, FaUsers, FaSpinner, FaListCheck } from 'react-icons/fa6';
import { FaMagic, FaShoppingCart } from 'react-icons/fa';
import { MdPlace } from 'react-icons/md';
import KonvaSeatViewer from '../components/KonvaSeatViewer';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const SeatMapPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [seatmapData, setSeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Seat-based state
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [holdInfo, setHoldInfo] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [holding, setHolding] = useState(false);
  const [booking, setBooking] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // filter for seat mode

  // Zone/Mixed state
  const [zonePopup, setZonePopup] = useState(null);       // { zone, quantity } for standing zones
  const [sectionPopup, setSectionPopup] = useState(null); // { section, quantity } for Best Available

  // Best Available result state
  const [baResult, setBaResult] = useState(null); // { seats_info, expires_at, held_seat_ids, is_contiguous, total }

  const timerRef = useRef(null);

  // Dynamic max per order: falls back to 10 if not set
  const getMaxPerOrder = (tierNameOrPrice) => {
    const tickets = seatmapData?.event?.tickets || [];
    if (!tickets.length) return 10;
    // Match by tier name first, then by price
    const match = tickets.find(t => t.type === tierNameOrPrice)
      || tickets.find(t => Math.abs(t.price - parseFloat(tierNameOrPrice)) < 0.01);
    return match?.max_per_order || 10;
  };
  // Global max: minimum across all tiers (safest default for seat mode)
  const globalMaxPerOrder = seatmapData?.event?.tickets?.length
    ? Math.min(...seatmapData.event.tickets.map(t => t.max_per_order || 10))
    : 10;
//  const [zoom, setZoom] = useState(1);

  // Konva container width measurement
  const seatContainerRef = useRef(null);
  const [seatContainerWidth, setSeatContainerWidth] = useState(800);


  const fetchSeatmap = useCallback(async () => {
    try {
      const res = await api.get(`/api/events/${id}/seatmap`);
      setSeatmapData(res.data);
      if (res.data.sections?.length > 0 && !activeSection) {
        setActiveSection(res.data.sections[0].name);
      }
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.msg || 'Không thể tải sơ đồ chỗ ngồi');
      setLoading(false);
    }
  }, [id]); // eslint-disable-line

  useEffect(() => {
    fetchSeatmap();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchSeatmap]);

  // Measure seat container width for Konva Stage
  useEffect(() => {
    const el = seatContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSeatContainerWidth(entry.contentRect.width || 800);
      }
    });
    ro.observe(el);
    setSeatContainerWidth(el.offsetWidth || 800);
    return () => ro.disconnect();
  }, []);

  // Inject SVG zone colors
  useEffect(() => {
    if ((seatmapData?.type === 'zone' || seatmapData?.type === 'mixed') && seatmapData.event.svg_layout) {
      seatmapData.zones.forEach(zone => {
        if (!zone.svg_id) return;
        // svg_id can be comma-separated for mixed mode
        const svgIds = zone.svg_id.split(',').map(s => s.trim()).filter(Boolean);
        svgIds.forEach(svgId => {
          const el = document.getElementById(svgId);
          if (el) {
            let available;
            if (zone.zone_type === 'seated' || zone.zone_type === 'best_available') {
              available = zone.seat_available ?? 0;
            } else {
              available = zone.capacity - (zone.sold || 0);
            }
            el.style.fill = available <= 0 ? '#444' : zone.color;
            el.style.opacity = available <= 0 ? '0.5' : '1';
            el.style.cursor = available <= 0 ? 'not-allowed' : 'pointer';
            if (available > 0) el.setAttribute('data-available', 'true');
          }
        });
      });
    }
  }, [seatmapData]);

  // Countdown timer
  useEffect(() => {
    const expiresAt = holdInfo?.expires_at || baResult?.expires_at;
    if (!expiresAt) { setCountdown(null); return; }

    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        setHoldInfo(null);
        setBaResult(null);
        setSelectedSeats([]);
        fetchSeatmap();
        alert('Thời gian giữ chỗ đã hết! Vui lòng chọn lại.');
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [holdInfo, baResult, fetchSeatmap]);


  const toggleSeat = (seat) => {
    if (seat.status === 'sold' || seat.status === 'held') return;
    if (holdInfo) return;
    setSelectedSeats(prev => {
      const exists = prev.find(s => s.id === seat.id);
      if (exists) return prev.filter(s => s.id !== seat.id);
    if (prev.length >= globalMaxPerOrder) {
        alert(`Tối đa ${globalMaxPerOrder} vé cho loại này!`);
        return prev;
      }
      return [...prev, seat];
    });
  };

  const handleHoldSeats = async () => {
    const token = localStorage.getItem('token');
    if (!token) { alert('Vui lòng đăng nhập!'); navigate('/login'); return; }
    if (selectedSeats.length === 0) return;
    setHolding(true);
    try {
      const res = await api.post('/api/seats/hold', { seat_ids: selectedSeats.map(s => s.id) });
      setHoldInfo({ expires_at: res.data.expires_at, seat_ids: res.data.held_seats });
      fetchSeatmap();
    } catch (err) {
      alert(err.response?.data?.msg || 'Không thể giữ chỗ!');
      setSelectedSeats([]);
      fetchSeatmap();
    } finally {
      setHolding(false);
    }
  };

  const handleReleaseSeats = async () => {
    try {
      await api.post('/api/seats/release');
      setHoldInfo(null);
      setBaResult(null);
      setSelectedSeats([]);
      setCountdown(null);
      fetchSeatmap();
    } catch (err) {
      alert('Lỗi khi giải phóng ghế');
    }
  };

  const handleBookSeats = async (seatIds) => {
    setBooking(true);
    try {
      let totalAmount = 0;

      if (baResult && baResult.total) {
        totalAmount = parseFloat(baResult.total);
      } else {
        const selectedSeatsData = selectedSeats.filter(s => seatIds.includes(s.id));
        totalAmount = selectedSeatsData.reduce((sum, seat) => sum + parseFloat(seat.price || 0), 0);
      }

      const orderData = {
        event_id: id,
        seat_ids: seatIds,
        zone_id: baResult?.zone_id || null,
        quantity: 0,
        total_amount: totalAmount,
        commission: totalAmount * 0.035,
        event_title: seatmapData?.event?.title || '',
      };

      const token = localStorage.getItem('token');
      if (!token) { alert('Vui lòng đăng nhập!'); navigate('/login'); return; }

      let queueData = null;
      try {
        const qRes = await api.post('/api/queue/join', { event_id: parseInt(id), ticket_data: orderData });
        queueData = qRes.data;
      } catch (qErr) {
        console.error('Queue join error:', qErr);
      }

      if (queueData && queueData.position > 0) {
        navigate('/waiting-room', {
          replace: true,
          state: {
            event_id: parseInt(id),
            event_title: seatmapData?.event?.title || '',
            queue_number: queueData.queue_number,
            position: queueData.position,
            estimated_wait_seconds: queueData.estimated_wait_seconds,
            ticket_data: orderData,
          }
        });
      } else {
        navigate('/payment', { replace: true, state: { orderData } });
      }
    } catch (err) {
      console.error('Error preparing payment:', err);
      alert('Lỗi khi chuẩn bị thanh toán');
    } finally {
      setBooking(false);
    }
  };


  const handleZonePurchase = async () => {
    const token = localStorage.getItem('token');
    if (!token) { alert('Vui lòng đăng nhập!'); navigate('/login'); return; }
    if (!zonePopup || zonePopup.quantity < 1) return;
    setBooking(true);
    try {
      const totalAmount = (parseFloat(zonePopup.zone.price) || 0) * zonePopup.quantity;

      const orderData = {
        event_id: parseInt(id),
        seat_ids: [],
        zone_id: zonePopup.zone.id,
        quantity: zonePopup.quantity,
        total_amount: totalAmount,
        commission: totalAmount * 0.035,
        event_title: seatmapData?.event?.title || '',
        ticket_type: zonePopup.zone.name || 'Vé khu vực',
      };

      let queueData = null;
      try {
        const qRes = await api.post('/api/queue/join', { event_id: parseInt(id), ticket_data: orderData });
        queueData = qRes.data;
      } catch (qErr) {
        console.error('Queue join error:', qErr);
      }

      setZonePopup(null);

      if (queueData && queueData.position > 0) {
        navigate('/waiting-room', {
          replace: true,
          state: {
            event_id: parseInt(id),
            event_title: seatmapData?.event?.title || '',
            queue_number: queueData.queue_number,
            position: queueData.position,
            estimated_wait_seconds: queueData.estimated_wait_seconds,
            ticket_data: orderData,
          }
        });
      } else {
        navigate('/payment', { replace: true, state: { orderData } });
      }
    } catch (err) {
      alert(err.response?.data?.msg || 'Lỗi khi chuẩn bị thanh toán');
    } finally {
      setBooking(false);
    }
  };


  const handleBestAvailable = async () => {
    const token = localStorage.getItem('token');
    if (!token) { alert('Vui lòng đăng nhập!'); navigate('/login'); return; }
    if (!sectionPopup) return;

    setBooking(true);
    try {
      const res = await api.post(`/api/events/${id}/best-available`, {
        zone_name: sectionPopup.section.name,
        quantity: sectionPopup.quantity
      });
      setSectionPopup(null);
      setBaResult({
        ...res.data,
        section_name: sectionPopup.section.name,
        price_per_seat: parseFloat(sectionPopup.section.price)
      });
      fetchSeatmap();
    } catch (err) {
      if (err.response?.data?.retry) {
        // Race condition — tự retry 1 lần
        setTimeout(() => handleBestAvailable(), 500);
        return;
      }
      alert(err.response?.data?.msg || 'Không tìm được ghế phù hợp!');
    } finally {
      setBooking(false);
    }
  };


  const styles = {
    page: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#eee', padding: '20px 20px 60px' },
    container: { maxWidth: '1200px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #222' },
    stage: { background: 'linear-gradient(135deg, #2CC275, #1a8a4a)', padding: '16px', borderRadius: '12px 12px 50% 50%', textAlign: 'center', color: 'white', fontWeight: '800', fontSize: '16px', letterSpacing: '4px', marginBottom: '32px', boxShadow: '0 4px 24px rgba(44,194,117,0.35)' },

    rowContainer: { display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px', justifyContent: 'center' },
    rowLabel: { width: '26px', textAlign: 'center', fontWeight: '700', color: '#666', fontSize: '12px' },
    seat: (status) => ({
      width: '28px', height: '28px', borderRadius: '5px 5px 7px 7px', border: 'none',
      cursor: status === 'available' || status === 'mine' ? 'pointer' : 'not-allowed',
      fontSize: '9px', fontWeight: '700',
      transition: 'all 0.15s',
      background: status === 'available' ? '#1e3028' : status === 'mine' ? '#FFD700' : status === 'sold' ? '#ff4d4f' : status === 'held' ? '#555' : status === 'selected' ? '#2CC275' : '#222',
      color: status === 'mine' || status === 'selected' ? '#000' : '#888',
      transform: (status === 'selected' || status === 'mine') ? 'scale(1.12)' : 'scale(1)',
      boxShadow: status === 'selected' ? '0 0 10px rgba(44,194,117,0.7)' : status === 'mine' ? '0 0 10px rgba(255,215,0,0.7)' : 'none',
    }),
    legend: { display: 'flex', gap: '16px', justifyContent: 'center', padding: '20px 0', flexWrap: 'wrap', borderTop: '1px solid #1a1a1a', marginTop: '20px' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888' },
    legendDot: (color) => ({ width: '14px', height: '14px', borderRadius: '4px', background: color }),
    sidebar: { background: '#111', borderRadius: '16px', padding: '24px', border: '1px solid #1e1e1e', position: 'sticky', top: '80px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
    zoneTile: (color, available) => ({
      background: available > 0 ? `linear-gradient(135deg, ${color}, ${color}cc)` : '#2a2a2a',
      padding: '20px 16px', borderRadius: '14px',
      cursor: available > 0 ? 'pointer' : 'not-allowed',
      textAlign: 'center', transition: 'all 0.3s',
      opacity: available > 0 ? 1 : 0.45,
      border: `2px solid ${available > 0 ? color + '66' : '#333'}`,
    }),
    popup: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
    popupContent: { background: '#161616', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '94%', border: '1px solid #2a2a2a', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' },
    btn: (active, color = '#2CC275') => ({
      width: '100%', padding: '14px', background: active ? color : '#333',
      color: active ? (color === '#2CC275' ? '#000' : 'white') : '#666',
      border: 'none', borderRadius: '10px',
      fontSize: '15px', fontWeight: '700',
      cursor: active ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
    }),
    countdownBar: { background: 'linear-gradient(90deg, #ff6b35, #ff4d4f)', padding: '12px 18px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', animation: 'pulse 2s infinite' },
    qtyBtn: { width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #444', background: '#222', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
    sectionTitle: { color: '#2CC275', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px', padding: '6px 14px', background: 'rgba(44,194,117,0.1)', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  };

  // ── Stage position-aware block ────────────────────────────────
  const stagePos = seatmapData?.event?.stage_position || 'top';

  const StageBlock = ({ position }) => {
    if (stagePos === 'none' || stagePos !== position) return null;
    const isVertical = position === 'left' || position === 'right';
    return (
      <div style={{
        background: 'linear-gradient(135deg, #2CC275, #1a8a4a)',
        padding: isVertical ? '40px 12px' : '14px 80px',
        borderRadius: position === 'top' ? '12px 12px 50% 50%'
          : position === 'bottom' ? '50% 50% 12px 12px'
          : position === 'left' ? '12px 50% 50% 12px'
          : '50% 12px 12px 50%',
        color: 'white', fontWeight: '800', fontSize: '16px', letterSpacing: '4px',
        textAlign: 'center', boxShadow: '0 4px 24px rgba(44,194,117,0.35)',
        alignSelf: 'center', flexShrink: 0,
        writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
        transform: position === 'left' ? 'rotate(180deg)' : 'none',
        marginBottom: position === 'top' ? '24px' : '0',
        marginTop: position === 'bottom' ? '24px' : '0',
        marginRight: position === 'left' ? '20px' : '0',
        marginLeft: position === 'right' ? '20px' : '0',
      }}>
        SÂN KHẤU
      </div>
    );
  };

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '120px', color: '#aaa' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}></div>
      <div>Đang tải sơ đồ chỗ ngồi...</div>
    </div>
  );
  if (error) return (
    <div style={{ textAlign: 'center', marginTop: '120px', color: '#ff4d4f' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px', color: '#ff4d4f' }}>!</div>
      <div style={{ marginBottom: '16px' }}>{error}</div>
      <Link to="/" style={{ color: '#2CC275' }}>← Trang chủ</Link>
    </div>
  );

  if (seatmapData.type === 'zone') {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <Link to={`/events/${id}`} style={{ color: '#aaa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <FaArrowLeft /> Quay lại sự kiện
          </Link>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ background: '#FFC10720', color: '#FFC107', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
              <FaUsers style={{ marginRight: '4px' }} />KHU VỰC ĐỨNG
            </span>
          </div>
          <h2 style={{ color: '#fff', marginBottom: '6px', fontSize: '22px' }}>{seatmapData.event.title}</h2>
          <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>Chọn khu vực bạn muốn và số lượng vé</p>

          {!seatmapData.event.svg_layout && stagePos !== 'none' && (
            <div style={{
              display: 'flex',
              flexDirection: stagePos === 'left' ? 'row' : stagePos === 'right' ? 'row-reverse' : stagePos === 'bottom' ? 'column-reverse' : 'column',
              alignItems: 'center',
              marginBottom: stagePos === 'top' || stagePos === 'bottom' ? '0' : '24px',
            }}>
              <StageBlock position={stagePos} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', maxWidth: '1400px' }}>
            {/* LEFT: SVG/zones map */}
            <div>
              {seatmapData.event.svg_layout ? (
                <div style={{ background: '#0d0d0d', borderRadius: '16px', border: '1px solid #1e1e1e', padding: '20px', overflow: 'auto', maxHeight: '600px' }}>
                  <div
                    dangerouslySetInnerHTML={{ __html: seatmapData.event.svg_layout }}
                    onClick={(e) => {
                      let target = e.target;
                      while (target && target !== e.currentTarget) {
                        const elId = target.getAttribute('id');
                        if (elId) {
                          const zone = seatmapData.zones.find(z => z.svg_id && z.svg_id.split(',').includes(elId));
                          if (zone) {
                            const available = zone.capacity - zone.sold;
                            if (available > 0) setZonePopup({ zone, quantity: 1 });
                            else alert(`Khu vực ${zone.name} đã hết vé!`);
                            return;
                          }
                        }
                        target = target.parentElement;
                      }
                    }}
                    className="interactive-svg-map"
                    style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  {seatmapData.zones.map(zone => {
                    const available = zone.capacity - zone.sold;
                    const pct = Math.round((zone.sold / zone.capacity) * 100);
                    return (
                      <div key={zone.id} style={styles.zoneTile(zone.color, available)}
                        onClick={() => available > 0 && setZonePopup({ zone, quantity: 1 })}
                        onMouseEnter={e => { if (available > 0) { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${zone.color}55`; } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.5)', marginBottom: '4px' }}>{zone.name}</div>
                        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', marginBottom: '8px', fontWeight: '600' }}>{fmt(zone.price)}</div>
                        <div style={{ width: '60%', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', overflow: 'hidden', margin: '0 auto 4px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.7)', borderRadius: '2px' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Còn {available}/{zone.capacity}</div>
                        {available <= 0 && <div style={{ fontSize: '10px', color: '#ff4d4f', fontWeight: '700', marginTop: '3px' }}>HẾT</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={styles.legend}>
                <div style={styles.legendItem}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#4A90D9' }} /> Còn chỗ</div>
                <div style={styles.legendItem}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#444' }} /> Hết chỗ</div>
              </div>
            </div>

            {/* RIGHT: Event info + Zone details panel */}
            <div style={{ ...styles.sidebar, height: 'fit-content' }}>
              {/* Event info header */}
              <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #222' }}>
                <div style={{ fontWeight: '700', color: '#fff', fontSize: '15px', marginBottom: '10px', lineHeight: '1.4' }}>
                  {seatmapData.event.title}
                </div>
                {seatmapData.event.event_date && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#888', fontSize: '12px', marginBottom: '6px' }}>
                    <FaClock style={{ color: '#2CC275', fontSize: '11px', marginTop: '2px', flexShrink: 0 }} />
                    <span>
                      {new Date(seatmapData.event.event_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'long', year: 'numeric' })}
                      {seatmapData.event.end_date && ` — ${new Date(seatmapData.event.end_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                )}
                {seatmapData.event.location && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#888', fontSize: '12px' }}>
                    <MdPlace style={{ color: '#2CC275', fontSize: '14px', flexShrink: 0 }} />
                    <span>{seatmapData.event.location}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <FaUsers style={{ color: '#FFC107', fontSize: '14px' }} />
                <strong style={{ color: '#fff', fontSize: '13px' }}>Giá vé</strong>
              </div>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {seatmapData.zones.map((zone, idx) => {
                  const available = zone.capacity - zone.sold;
                  return (
                    <div 
                      key={zone.id}
                      onClick={() => available > 0 && setZonePopup({ zone, quantity: 1 })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px',
                        marginBottom: idx < seatmapData.zones.length - 1 ? '6px' : '0',
                        cursor: available > 0 ? 'pointer' : 'not-allowed',
                        opacity: available > 0 ? 1 : 0.5,
                        borderRadius: '8px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (available > 0) e.currentTarget.style.background = '#1a1a1a'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: zone.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#ddd', fontSize: '13px', fontWeight: '600' }}>{zone.name}</div>
                        <div style={{ color: '#555', fontSize: '11px' }}>Đứng</div>
                      </div>
                      <div style={{ color: zone.color, fontWeight: '700', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {fmt(zone.price)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #222' }}>
                <button
                  style={{ width: '100%', padding: '13px', background: '#222', color: '#888', border: '1px solid #333', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'default' }}
                >
                  Bấm vào khu vực để chọn vé »
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Zone popup */}
        {zonePopup && (
          <div style={styles.popup} onClick={() => setZonePopup(null)}>
            <div style={styles.popupContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: zonePopup.zone.color, marginBottom: '20px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MdPlace /> {zonePopup.zone.name}
              </h3>
              <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Giá vé</span>
                  <strong style={{ color: '#2CC275' }}>{fmt(zonePopup.zone.price)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button style={styles.qtyBtn} onClick={() => setZonePopup(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}>−</button>
                <span style={{ fontSize: '32px', fontWeight: '800', minWidth: '50px', textAlign: 'center' }}>{zonePopup.quantity}</span>
                <button style={styles.qtyBtn} onClick={() => setZonePopup(p => ({ ...p, quantity: Math.min(getMaxPerOrder(p.zone.name), p.quantity + 1, p.zone.capacity - p.zone.sold) }))}>+</button>
              </div>

              <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: '800', color: '#2CC275', marginBottom: '24px' }}>
                {fmt(zonePopup.zone.price * zonePopup.quantity)}
              </div>

              <button onClick={handleZonePurchase} disabled={booking} style={styles.btn(!booking)}>
                {booking ? 'Đang xử lý...' : `Mua ${zonePopup.quantity} vé ngay`}
              </button>
              <button onClick={() => setZonePopup(null)} style={{ ...styles.btn(true, 'transparent'), border: '1px solid #444', color: '#888', marginTop: '10px' }}>
                Hủy
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
          .interactive-svg-map svg { max-width: 100%; height: auto; }
          .interactive-svg-map [data-available="true"]:hover { filter: brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.4)); stroke: #fff; stroke-width: 2px; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  if (seatmapData.type === 'mixed') {
    const allZones = seatmapData.zones || [];
    const standingZones = allZones.filter(z => z.zone_type === 'standing' || (!z.zone_type && !z.seat_total));
    const seatedZones = allZones.filter(z => z.zone_type === 'seated');
    const baZones = allZones.filter(z => z.zone_type === 'best_available');

    const handleSeatedZoneClick = (zone) => {
      if (zone.seat_available <= 0) return;
      // Reuse sectionPopup state — map zone fields to section-like object
      setSectionPopup({
        section: {
          name: zone.name,
          price: zone.price,
          available: zone.seat_available,
          total: zone.seat_total,
          isZoneSeated: true,
        },
        quantity: 2,
      });
    };

    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <Link to={`/events/${id}`} style={{ color: '#aaa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <FaArrowLeft /> Quay lại sự kiện
          </Link>

          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {standingZones.length > 0 && (
              <span style={{ background: '#FFC10720', color: '#FFC107', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                <FaUsers style={{ marginRight: "4px" }} /> {standingZones.length} KHU ĐỨNG
              </span>
            )}
            {seatedZones.length > 0 && (
              <span style={{ background: '#1890ff20', color: '#1890ff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                <FaChair style={{ marginRight: "4px" }} /> {seatedZones.length} KHU CHỌN GHẾ
              </span>
            )}
            {baZones.length > 0 && (
              <span style={{ background: '#FFC10720', color: '#FFC107', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                <FaMagic style={{ marginRight: "4px" }} /> {baZones.length} BEST AVAILABLE
              </span>
            )}
          </div>
          <h2 style={{ color: '#fff', marginBottom: '6px', fontSize: '22px' }}>{seatmapData.event.title}</h2>
          <p style={{ color: '#666', marginBottom: '28px', fontSize: '14px' }}>
            Bấm vào khu vực để chọn vé — hệ thống tự chọn ghế tốt nhất cho khu ngồi
          </p>

          {/* Unified 2-col layout: left = map/zones, right = event info + ticket list */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
            {/* LEFT col */}
            <div>
              {/* SVG map or stage placeholder */}
              {seatmapData.event.svg_layout ? (
                <div className="interactive-svg-map" style={{ background: '#0d0d0d', borderRadius: '16px', border: '1px solid #1e1e1e', padding: '16px', overflow: 'auto', marginBottom: '20px' }}>
                  <div
                    dangerouslySetInnerHTML={{ __html: seatmapData.event.svg_layout }}
                    onClick={(e) => {
                      const el = e.target;
                      const svgId = el.getAttribute('id');
                      if (!svgId) return;
                      const zone = allZones.find(z => z.svg_id && z.svg_id.split(',').includes(svgId));
                      if (!zone) return;
                      if (zone.zone_type === 'seated') {
                        handleSeatedZoneClick(zone);
                      } else if (zone.zone_type === 'best_available') {
                        // Best Available: popup chọn số lượng, gọi API best-available
                        const available = zone.seat_available ?? 0;
                        if (available > 0) {
                          setSectionPopup({
                            section: { name: zone.name, price: zone.price, available, total: zone.seat_total, isZoneSeated: true },
                            quantity: 2
                          });
                        }
                      } else {
                        const available = zone.capacity - (zone.sold || 0);
                        if (available > 0) setZonePopup({ zone, quantity: 1 });
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                  <style>{`
                    .interactive-svg-map svg { max-width: 100%; height: auto; }
                    .interactive-svg-map [id]:hover { filter: brightness(1.25) drop-shadow(0 0 6px rgba(255,255,255,0.3)); cursor: pointer; transition: filter 0.15s; }
                  `}</style>
                </div>
              ) : (
                <>
                  {/* Stage + zones layout based on position */}
                  <div style={{
                    display: 'flex',
                    flexDirection: stagePos === 'left' ? 'row' : stagePos === 'right' ? 'row-reverse' : stagePos === 'bottom' ? 'column-reverse' : 'column',
                    alignItems: stagePos === 'left' || stagePos === 'right' ? 'flex-start' : 'stretch',
                  }}>
                    {stagePos !== 'none' && <StageBlock position={stagePos} />}
                  {/* Standing zones tiles */}
                  {standingZones.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <FaUsers style={{ fontSize: "14px", color: '#FFC107' }} />
                        <span style={{ color: '#FFC107', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' }}>Khu đứng</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                        {standingZones.map(zone => {
                          const available = zone.capacity - (zone.sold || 0);
                          const pct = Math.round(((zone.sold || 0) / zone.capacity) * 100);
                          return (
                            <div key={zone.id} style={styles.zoneTile(zone.color, available)}
                              onClick={() => available > 0 && setZonePopup({ zone, quantity: 1 })}
                              onMouseEnter={e => { if (available > 0) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${zone.color}44`; } }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>{zone.name}</div>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', marginBottom: '6px', fontWeight: '600' }}>{fmt(zone.price)}</div>
                              <div style={{ width: '60%', height: '3px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', overflow: 'hidden', margin: '0 auto 4px' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.7)', borderRadius: '2px' }} />
                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{available > 0 ? `${available}/${zone.capacity}` : 'HẾT'}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Seated zones tiles */}
                  {seatedZones.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <FaChair style={{ fontSize: "14px", color: '#1890ff' }} />
                        <span style={{ color: '#1890ff', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' }}>Khu ngồi</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                        {seatedZones.map(zone => {
                          const available = zone.seat_available ?? 0;
                          const total = zone.seat_total ?? 0;
                          const hasSeats = available > 0;
                          return (
                            <div key={zone.id}
                              onClick={() => hasSeats && handleSeatedZoneClick(zone)}
                              onMouseEnter={e => { if (hasSeats) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${zone.color}44`; } }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                              style={{ background: hasSeats ? `${zone.color}15` : '#1a1a1a', border: `1px solid ${hasSeats ? zone.color + '40' : '#333'}`, borderRadius: '12px', padding: '14px', cursor: hasSeats ? 'pointer' : 'not-allowed', textAlign: 'center', transition: 'all 0.3s', opacity: hasSeats ? 1 : 0.5 }}>
                              <div style={{ fontSize: '18px', marginBottom: '6px' }}><FaChair /></div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>{zone.name}</div>
                              <div style={{ fontSize: '12px', color: zone.color, fontWeight: '700', marginBottom: '4px' }}>{fmt(zone.price)}</div>
                              <div style={{ fontSize: '11px', color: '#888' }}>{available}/{total}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Best Available zones tiles */}
                  {baZones.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <FaMagic style={{ fontSize: "14px", color: '#FFC107' }} />
                        <span style={{ color: '#FFC107', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' }}>Best Available</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                        {baZones.map(zone => {
                          const available = zone.seat_available ?? 0;
                          const total = zone.seat_total ?? 0;
                          const hasSeats = available > 0;
                          return (
                            <div key={zone.id}
                              onClick={() => hasSeats && setSectionPopup({
                                section: { name: zone.name, price: zone.price, available, total: zone.seat_total, isZoneSeated: true },
                                quantity: 2
                              })}
                              onMouseEnter={e => { if (hasSeats) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${zone.color}44`; } }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                              style={{ background: hasSeats ? `${zone.color}15` : '#1a1a1a', border: `1px solid ${hasSeats ? zone.color + '40' : '#333'}`, borderRadius: '12px', padding: '14px', cursor: hasSeats ? 'pointer' : 'not-allowed', textAlign: 'center', transition: 'all 0.3s', opacity: hasSeats ? 1 : 0.5 }}>
                              <div style={{ fontSize: '18px', marginBottom: '6px', color: '#FFC107' }}><FaMagic /></div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>{zone.name}</div>
                              <div style={{ fontSize: '12px', color: zone.color, fontWeight: '700', marginBottom: '4px' }}>{fmt(zone.price)}</div>
                              <div style={{ fontSize: '11px', color: '#888' }}>{available}/{total} ghế</div>
                              <div style={{ fontSize: '10px', color: '#FFC107', marginTop: '4px' }}>Tự gán chỗ tốt nhất</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>{/* end stage-aware layout */}
                </>
              )}

              {/* Best Available result banner */}
              {baResult && (
                <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '24px', marginTop: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                  {/* Success header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #1e1e1e' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2CC27518', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaCircleCheck style={{ color: '#2CC275', fontSize: '16px' }} />
                    </div>
                    <strong style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: '700' }}>Đã giữ ghế thành công</strong>
                  </div>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Khu vực</div>
                      <div style={{ fontSize: '15px', color: '#fff', fontWeight: '700' }}>{baResult.section_name}</div>
                    </div>
                    <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Ghế</div>
                      <div style={{ fontSize: '15px', color: '#fff', fontWeight: '700' }}>
                        {baResult.seats_info.map(s => s.label).join(', ')}
                        {baResult.is_contiguous && <span style={{ color: '#2CC275', fontSize: '11px', marginLeft: '6px', fontWeight: '600' }}>Liền kề</span>}
                      </div>
                    </div>
                  </div>

                  {/* Countdown */}
                  {countdown && (
                    <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px', border: '1px solid #252525' }}>
                      <FaClock style={{ color: '#999', fontSize: '13px' }} />
                      <span style={{ color: '#ccc', fontWeight: '700', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px' }}>{countdown}</span>
                      <span style={{ color: '#666', fontSize: '12px' }}>để thanh toán</span>
                    </div>
                  )}

                  {/* Total */}
                  <div style={{ marginBottom: '20px', background: '#1a1a1a', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>Giá gốc</span>
                      <span style={{ fontSize: '13px', color: '#ccc', fontWeight: '600' }}>{fmt(baResult.total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}>
                        Phí dịch vụ
                        <span style={{ background: 'rgba(44,194,117,0.15)', color: '#2CC275', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>3.5%</span>
                      </span>
                      <span style={{ fontSize: '13px', color: '#aaa' }}>+{Math.round(baResult.total * 0.035).toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Tổng thanh toán</span>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>{(baResult.total + Math.round(baResult.total * 0.035)).toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button onClick={() => handleBookSeats(baResult.held_seat_ids)} disabled={booking}
                    style={{ width: '100%', padding: '14px', background: '#2CC275', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: booking ? 'not-allowed' : 'pointer', opacity: booking ? 0.6 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FaCircleCheck />{booking ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                  </button>
                  <button onClick={handleReleaseSeats}
                    style={{ width: '100%', padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '8px', transition: 'all 0.2s' }}>
                    Hủy & chọn lại
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT col: event info + ticket list sidebar */}
            <div style={{ ...styles.sidebar, position: 'sticky', top: '80px' }}>
              {/* Event info */}
              <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #222' }}>
                <div style={{ fontWeight: '700', color: '#fff', fontSize: '15px', marginBottom: '10px', lineHeight: '1.4' }}>
                  {seatmapData.event.title}
                </div>
                {seatmapData.event.event_date && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#888', fontSize: '12px', marginBottom: '6px' }}>
                    <FaClock style={{ color: '#2CC275', fontSize: '11px', marginTop: '2px', flexShrink: 0 }} />
                    <span>
                      {new Date(seatmapData.event.event_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'long', year: 'numeric' })}
                      {seatmapData.event.end_date && ` — ${new Date(seatmapData.event.end_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                )}
                {seatmapData.event.location && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#888', fontSize: '12px' }}>
                    <MdPlace style={{ color: '#2CC275', fontSize: '14px', flexShrink: 0 }} />
                    <span>{seatmapData.event.location}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <FaListCheck style={{ color: '#aaa', fontSize: '13px' }} />
                <strong style={{ color: '#fff', fontSize: '13px' }}>Giá vé</strong>
              </div>

              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {allZones.map((zone, idx) => {
                  const available = (zone.zone_type === 'seated' || zone.zone_type === 'best_available') ? (zone.seat_available ?? 0) : (zone.capacity - (zone.sold || 0));
                  return (
                    <div
                      key={zone.id}
                      onClick={() => {
                        if (available <= 0) return;
                        if (zone.zone_type === 'seated') handleSeatedZoneClick(zone);
                        else if (zone.zone_type === 'best_available') setSectionPopup({ section: { name: zone.name, price: zone.price, available, total: zone.seat_total, isZoneSeated: true }, quantity: 2 });
                        else setZonePopup({ zone, quantity: 1 });
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', marginBottom: idx < allZones.length - 1 ? '4px' : '0', cursor: available > 0 ? 'pointer' : 'not-allowed', opacity: available > 0 ? 1 : 0.5, borderRadius: '8px', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (available > 0) e.currentTarget.style.background = '#1a1a1a'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: zone.color || '#1890ff', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#ddd', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</div>
                        <div style={{ color: '#555', fontSize: '10px' }}>{zone.zone_type === 'best_available' ? 'Best Available' : zone.zone_type === 'seated' ? 'Chọn ghế' : 'Đứng'}</div>
                      </div>
                      <div style={{ color: zone.color || '#1890ff', fontWeight: '700', fontSize: '12px', whiteSpace: 'nowrap' }}>{fmt(zone.price)}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #222' }}>
                <button style={{ width: '100%', padding: '13px', background: '#222', color: '#888', border: '1px solid #333', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'default' }}>
                  Bấm vào khu vực để chọn vé »
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Zone popup (standing) */}
        {zonePopup && (
          <div style={styles.popup} onClick={() => setZonePopup(null)}>
            <div style={styles.popupContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: zonePopup.zone.color, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaUsers style={{ marginRight: "4px" }} /> {zonePopup.zone.name}
              </h3>
              <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Giá vé</span><strong style={{ color: '#2CC275' }}>{fmt(zonePopup.zone.price)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button style={styles.qtyBtn} onClick={() => setZonePopup(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}>−</button>
                <span style={{ fontSize: '32px', fontWeight: '800' }}>{zonePopup.quantity}</span>
                <button style={styles.qtyBtn} onClick={() => setZonePopup(p => ({ ...p, quantity: Math.min(getMaxPerOrder(p.zone.name), p.quantity + 1, p.zone.capacity - (p.zone.sold || 0)) }))}>+</button>
              </div>
              <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: '800', color: '#2CC275', marginBottom: '24px' }}>{fmt(zonePopup.zone.price * zonePopup.quantity)}</div>
              <button onClick={handleZonePurchase} disabled={booking} style={styles.btn(!booking)}>{booking ? 'Đang xử lý...' : `Mua ${zonePopup.quantity} vé`}</button>
              <button onClick={() => setZonePopup(null)} style={{ ...styles.btn(true, 'transparent'), border: '1px solid #444', color: '#888', marginTop: '10px' }}>Hủy</button>
            </div>
          </div>
        )}

        {/* Best Available popup (seated zones) */}
        {sectionPopup && (
          <div style={styles.popup} onClick={() => setSectionPopup(null)}>
            <div style={styles.popupContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <FaMagic style={{ color: '#1890ff', fontSize: '22px' }} />
                <h3 style={{ margin: 0, color: '#1890ff', fontSize: '18px' }}><FaChair style={{ marginRight: "4px" }} /> {sectionPopup.section.name}</h3>
              </div>
              <div style={{ background: '#0d1b2e', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #1890ff30' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#888', fontSize: '14px' }}>Giá mỗi ghế</span>
                  <strong style={{ color: '#1890ff' }}>{fmt(sectionPopup.section.price)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '14px' }}>Số ghế còn</span>
                  <strong style={{ color: '#2CC275' }}>{sectionPopup.section.available ?? sectionPopup.section.seat_available ?? '?'} ghế</strong>
                </div>
              </div>
              <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
                Hệ thống sẽ tự động tìm ghế liền kề nhau ở hàng đẹp nhất
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button style={styles.qtyBtn} onClick={() => setSectionPopup(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}>−</button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '800' }}>{sectionPopup.quantity}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>vé</div>
                </div>
                <button style={styles.qtyBtn} onClick={() => setSectionPopup(p => ({ ...p, quantity: Math.min(getMaxPerOrder(p.section.name), p.quantity + 1) }))}>+</button>
              </div>
              <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: '800', color: '#1890ff', marginBottom: '24px' }}>
                {fmt(sectionPopup.section.price * sectionPopup.quantity)}
              </div>
              <button onClick={handleBestAvailable} disabled={booking} style={styles.btn(!booking, '#1890ff')}>
                <FaMagic style={{ marginRight: '8px' }} />
                {booking ? 'Đang tìm ghế...' : 'Hệ thống chọn ghế đẹp nhất'}
              </button>
              <button onClick={() => setSectionPopup(null)} style={{ ...styles.btn(true, 'transparent'), border: '1px solid #444', color: '#888', marginTop: '10px' }}>Hủy</button>
            </div>
          </div>
        )}

        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }`}</style>
      </div>
    );
  }


  const sections = seatmapData.sections || [];

  // Derive unique tier info from sections for color legend
  const tierMap = {};
  sections.forEach(sec => {
    if (!tierMap[sec.name]) {
      tierMap[sec.name] = { name: sec.name, price: sec.price, color: sec.color };
    }
  });
  // eslint-disable-next-line no-unused-vars
  const tiers = Object.values(tierMap);

  // Get section color by name (stored in section.color if available)
  const getSectionBg = (sectionName) => {
    const s = sections.find(x => x.name === sectionName);
    return s?.color ? `${s.color}22` : '#1a2a1a';
  };
  const getSectionBorder = (sectionName) => {
    const s = sections.find(x => x.name === sectionName);
    return s?.color ? `${s.color}66` : '#2a3a2a';
  };
  const getSectionColor = (sectionName) => {
    const s = sections.find(x => x.name === sectionName);
    return s?.color || '#2CC275';
  };

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Link to={`/events/${id}`} style={{ color: '#aaa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <FaArrowLeft /> Quay lại sự kiện
        </Link>


        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '24px', alignItems: 'start' }}>
          {/* LEFT: Konva Seat map Canvas */}
          <div ref={seatContainerRef}>
            <KonvaSeatViewer
              sections={sections}
              selectedSeats={selectedSeats}
              holdInfo={holdInfo}
              onSeatClick={(seat) => toggleSeat(seat)}
              getSectionColor={getSectionColor}
              containerWidth={seatContainerWidth}
            />
          </div>

          {/* RIGHT: Event info + Cart Sidebar */}
          <div style={{ ...styles.sidebar, position: 'sticky', top: '20px' }}>
            {/* Event info */}
            <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #222' }}>
              <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px', marginBottom: '10px', lineHeight: '1.4' }}>
                {seatmapData.event.title}
              </div>
              {seatmapData.event.event_date && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#888', fontSize: '12px', marginBottom: '6px' }}>
                  <FaClock style={{ color: '#2CC275', fontSize: '11px', marginTop: '2px', flexShrink: 0 }} />
                  <span>
                    {new Date(seatmapData.event.event_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'long', year: 'numeric' })}
                    {seatmapData.event.end_date && ` — ${new Date(seatmapData.event.end_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>
              )}
              {seatmapData.event.location && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#888', fontSize: '12px' }}>
                  <MdPlace style={{ color: '#2CC275', fontSize: '14px', flexShrink: 0 }} />
                  <span>{seatmapData.event.location}</span>
                </div>
              )}
            </div>

            {/* Tier price list */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#aaa', fontSize: '12px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Giá vé</div>
              {sections.map((section) => (
                <div key={section.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '28px', height: '14px', borderRadius: '3px', background: getSectionBg(section.name), border: `1px solid ${getSectionBorder(section.name)}`, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#ccc', fontSize: '13px' }}>{section.name}</span>
                  <span style={{ color: getSectionColor(section.name), fontWeight: '700', fontSize: '13px' }}>{fmt(section.price)}</span>
                </div>
              ))}
            </div>

            {/* Cart */}
            <div style={{ borderTop: '1px solid #222', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <FaShoppingCart style={{ color: '#2CC275', fontSize: '14px' }} />
                <strong style={{ color: '#fff', fontSize: '13px' }}>Đã chọn ({selectedSeats.length}/{globalMaxPerOrder})</strong>
              </div>

              {selectedSeats.length === 0 ? (
                <div style={{ color: '#444', textAlign: 'center', padding: '16px 0', fontSize: '13px' }}>
                  Chọn ghế ở sơ đồ bên trái
                </div>
              ) : (
                <>
                  {holdInfo && countdown && (
                    <div style={styles.countdownBar}>
                      <FaClock /> <strong style={{ fontFamily: 'monospace' }}>{countdown}</strong>
                      <span style={{ fontSize: '12px' }}>còn lại</span>
                    </div>
                  )}

                  <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '10px', marginBottom: '12px', maxHeight: '150px', overflowY: 'auto' }}>
                    {selectedSeats.map((seat, i) => (
                      <div key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < selectedSeats.length - 1 ? '1px solid #2a2a2a' : 'none', color: '#aaa', fontSize: '12px' }}>
                        <span><strong style={{ color: '#fff' }}>{seat.rowLabel}{seat.number}</strong> <span style={{ color: '#666' }}>({seat.section})</span></span>
                        <button onClick={() => setSelectedSeats(prev => prev.filter(s => s.id !== seat.id))} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>✕</button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>
                    <span style={{ color: '#aaa' }}>Tổng cộng</span>
                    <span style={{ color: '#2CC275' }}>{fmt(selectedSeats.reduce((sum, seat) => sum + parseFloat(seat.price || 0), 0))}</span>
                  </div>

                  {!holdInfo ? (
                    <button onClick={handleHoldSeats} disabled={holding || selectedSeats.length === 0} style={styles.btn(!holding && selectedSeats.length > 0)}>
                      {holding ? <><FaSpinner style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />Đang giữ...</> : <><FaShoppingCart style={{ marginRight: '8px' }} />Giữ chỗ ({selectedSeats.length} ghế)</>}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleBookSeats(selectedSeats.map(s => s.id))} disabled={booking} style={styles.btn(!booking)}>
                        {booking ? <><FaSpinner style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />Đang xử lý...</> : <><FaCircleCheck style={{ marginRight: '8px' }} />Xác nhận thanh toán</>}
                      </button>
                      <button onClick={handleReleaseSeats} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#ff4d4f', border: '1px solid #ff4d4f', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' }}>Hủy & chọn lại</button>
                    </>
                  )}
                </>
              )}

              {selectedSeats.length === 0 && (
                <button style={{ width: '100%', padding: '13px', background: '#1a1a1a', color: '#555', border: '1px solid #2a2a2a', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'default', marginTop: '8px' }}>
                  Vui lòng chọn vé »
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SeatMapPage;
