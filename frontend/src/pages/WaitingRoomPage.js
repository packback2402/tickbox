import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const WaitingRoomPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    event_id,
    queue_number: initialQueueNum,
    position: initialPosition,
    ticket_data,
    event_title,
  } = location.state || {};

  const [position, setPosition]         = useState(initialPosition ?? 1);
  const [queueNumber, setQueueNumber]   = useState(initialQueueNum ?? null);
  const [totalWaiting, setTotalWaiting] = useState(Math.max(initialPosition ?? 1, 1));
  const [expiresAt, setExpiresAt]       = useState(null);
  const [sessionLeft, setSessionLeft]   = useState('');
  const [countdown, setCountdown]       = useState('');
  const [phase, setPhase]               = useState('waiting'); // 'waiting' | 'redirecting' | 'expired'

  // Track initial position to calculate progress
  const initialPosRef  = useRef(initialPosition ?? 1);

  // Use refs to avoid stale closure in setInterval
  const phaseRef       = useRef(phase);
  const pollingRef     = useRef(null);
  const sessionRef     = useRef(null);
  const proceedingRef  = useRef(false);

  phaseRef.current = phase;

  // ─── Navigate to payment ───────────────────────────────────────────────────
  const proceedToPayment = () => {
    if (proceedingRef.current) return;
    proceedingRef.current = true;
    setPhase('redirecting');
    clearInterval(pollingRef.current);
    clearInterval(sessionRef.current);

    // Clean up queue entry
    api.delete('/api/queue/leave', { data: { event_id } }).catch(() => {});

    setTimeout(() => {
      navigate('/payment', {
        replace: true,
        state: {
          orderData: {
            ...ticket_data,
            event_id,
            event_title,
          }
        }
      });
    }, 1200);
  };

  // ─── Poll queue status ─────────────────────────────────────────────────────
  const doPoll = async () => {
    if (phaseRef.current !== 'waiting') return;
    if (!event_id) return;
    try {
      const res = await api.get(`/api/queue/status?event_id=${event_id}`);
      const { position: pos, total_waiting, expires_at, queue_number: qn } = res.data;

      setPosition(pos);
      setTotalWaiting(total_waiting);
      if (qn) setQueueNumber(qn);
      if (expires_at) setExpiresAt(expires_at);

      if (pos === 0) {
        proceedToPayment();
      }
    } catch (err) {
      const status = err.response?.status;
      const data   = err.response?.data;

      if (status === 410 || data?.expired) {
        // Session expired
        setPhase('expired');
        clearInterval(pollingRef.current);
        clearInterval(sessionRef.current);
      } else if (status === 404) {
        // Entry not found in queue → no one is blocking → proceed to payment
        proceedToPayment();
      }
      // Other errors: silent retry next interval
    }
  };

  // ─── Start polling on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!event_id) { navigate('/'); return; }

    doPoll(); // immediate first poll
    pollingRef.current = setInterval(doPoll, 5000);

    return () => {
      clearInterval(pollingRef.current);
      clearInterval(sessionRef.current);
    };
  }, []); // eslint-disable-line

  // ─── Session countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setSessionLeft('00:00');
        setPhase('expired');
        clearInterval(sessionRef.current);
        clearInterval(pollingRef.current);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setSessionLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    sessionRef.current = setInterval(tick, 1000);
    return () => clearInterval(sessionRef.current);
  }, [expiresAt]);

  // ─── Estimated wait label ──────────────────────────────────────────────────
  useEffect(() => {
    if (position <= 0) { setCountdown('Sắp đến lượt'); return; }
    const secs = position * 180;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    setCountdown(m > 0 ? `~${m} phút` + (s > 0 ? ` ${s}s` : '') : `~${s} giây`);
  }, [position]);

  // ─── Leave queue ───────────────────────────────────────────────────────────
  const handleLeave = async () => {
    clearInterval(pollingRef.current);
    clearInterval(sessionRef.current);
    try { await api.delete('/api/queue/leave', { data: { event_id } }); } catch (_) {}
    navigate(event_id ? `/events/${event_id}` : '/');
  };

  // ─── Progress: how far has position moved from initial ────────────────────
  const progressPct = (() => {
    const init = initialPosRef.current;
    if (init <= 0) return 100;
    // How many positions have been served: init - current
    const served = Math.max(0, init - position);
    return Math.max(8, Math.round((served / init) * 100));
  })();

  // ─── Inline CSS ───────────────────────────────────────────────────────────
  const css = `
    @keyframes wr-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes wr-glow   { 0%,100%{box-shadow:0 0 20px rgba(44,194,117,.3)} 50%{box-shadow:0 0 40px rgba(44,194,117,.7)} }
    @keyframes wr-slide  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes wr-shimmer{ 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes wr-dots   { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
    .wr-dot{width:7px;height:7px;background:#2CC275;border-radius:50%;display:inline-block;animation:wr-dots 1.4s ease-in-out infinite}
    .wr-dot:nth-child(1){animation-delay:0s}
    .wr-dot:nth-child(2){animation-delay:.2s}
    .wr-dot:nth-child(3){animation-delay:.4s}
  `;

  // ─── Render: Expired ──────────────────────────────────────────────────────
  if (phase === 'expired') {
    return (
      <div style={{ minHeight:'100vh', background:'#080808', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif' }}>
        <style>{css}</style>
        <div style={{ textAlign:'center', animation:'wr-slide .4s ease', maxWidth:380, padding:'0 24px' }}>
          <div style={{ width:76, height:76, borderRadius:'50%', background:'rgba(255,77,79,.12)', border:'2px solid rgba(255,77,79,.35)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#ff4d4f"/>
            </svg>
          </div>
          <h2 style={{ color:'#ff4d4f', fontSize:21, fontWeight:700, margin:'0 0 10px' }}>Phiên chờ đã hết hạn</h2>
          <p style={{ color:'#555', fontSize:14, lineHeight:1.6, marginBottom:24 }}>
            Thời gian chờ tối đa đã hết.<br/>Vui lòng vào hàng lại để tiếp tục.
          </p>
          <button onClick={() => navigate(event_id ? `/events/${event_id}` : '/')}
            style={{ background:'#2CC275', color:'#000', border:'none', borderRadius:10, padding:'12px 28px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Quay lại sự kiện
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Redirecting ──────────────────────────────────────────────────
  if (phase === 'redirecting') {
    return (
      <div style={{ minHeight:'100vh', background:'#080808', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif' }}>
        <style>{css}</style>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(44,194,117,.12)', border:'2px solid #2CC275', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, animation:'wr-glow 1.5s ease-in-out infinite' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2CC275" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style={{ color:'#2CC275', fontSize:22, fontWeight:700, margin:'0 0 8px' }}>Đến lượt bạn!</h2>
        <p style={{ color:'#666', fontSize:14 }}>Đang chuyển đến trang thanh toán...</p>
      </div>
    );
  }

  // ─── Render: Waiting ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#080808', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{css}</style>

      <div style={{ width:'100%', maxWidth:500, animation:'wr-slide .5s ease' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:76, height:76, borderRadius:'50%', background:'linear-gradient(135deg,#0d2e1a,#161616)', border:'2px solid rgba(44,194,117,.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', animation:'wr-float 3s ease-in-out infinite' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2CC275" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h1 style={{ color:'#fff', fontSize:22, fontWeight:800, margin:'0 0 6px', letterSpacing:'-0.4px' }}>Phòng chờ</h1>
          {event_title && (
            <p style={{ color:'#888', fontSize:13, margin:0, lineHeight:1.5 }}>{event_title}</p>
          )}
        </div>

        {/* Queue number + position card */}
        <div style={{ background:'linear-gradient(135deg,#0c1c12,#111)', border:'1px solid rgba(44,194,117,.18)', borderRadius:18, padding:'24px 20px', marginBottom:14, textAlign:'center', position:'relative', overflow:'hidden' }}>
          {/* Radial glow */}
          <div style={{ position:'absolute', top:-50, left:'50%', transform:'translateX(-50%)', width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(44,194,117,.07) 0%,transparent 70%)', pointerEvents:'none' }} />

          <div style={{ color:'#888', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:2.5, marginBottom:8 }}>
            Số thứ tự của bạn
          </div>

          {/* Big queue number */}
          {queueNumber != null ? (
            <div style={{ fontSize:68, fontWeight:900, lineHeight:1, background:'linear-gradient(135deg,#2CC275,#7effc4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:6, fontVariantNumeric:'tabular-nums' }}>
              #{queueNumber}
            </div>
          ) : (
            <div style={{ fontSize:68, fontWeight:900, lineHeight:1, color:'#2a2a2a', marginBottom:6 }}>
              #...
            </div>
          )}

          <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(44,194,117,.15),transparent)', margin:'16px 0' }} />

          {/* Position / Total */}
          {position <= 0 ? (
            <div style={{ color:'#2CC275', fontWeight:700, fontSize:15 }}>Sắp đến lượt bạn!</div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20 }}>
              <div>
                <div style={{ color:'#888', fontSize:10, textTransform:'uppercase', letterSpacing:1.5, marginBottom:4 }}>Vị trí</div>
                <div style={{ color:'#fff', fontSize:30, fontWeight:800, lineHeight:1 }}>{position}</div>
              </div>
              <div style={{ color:'#444', fontSize:24 }}>/</div>
              <div>
                <div style={{ color:'#888', fontSize:10, textTransform:'uppercase', letterSpacing:1.5, marginBottom:4 }}>Đang chờ</div>
                <div style={{ color:'#ccc', fontSize:30, fontWeight:700, lineHeight:1 }}>{totalWaiting}</div>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ background:'#111', border:'1px solid #252525', borderRadius:12, padding:'16px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:9 }}>
            <span style={{ color:'#888', fontSize:11, fontWeight:600 }}>Tiến trình hàng chờ</span>
            <span style={{ color:'#2CC275', fontSize:11, fontWeight:700 }}>{progressPct}%</span>
          </div>
          <div style={{ height:7, background:'#1a1a1a', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progressPct}%`, background:'linear-gradient(90deg,#1a6640,#2CC275)', borderRadius:99, transition:'width 0.9s cubic-bezier(.4,0,.2,1)', backgroundSize:'200% 100%', animation:'wr-shimmer 2.5s linear infinite' }} />
          </div>
        </div>

        {/* Estimated + Session */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <div style={{ background:'#111', border:'1px solid #252525', borderRadius:11, padding:'13px 14px', textAlign:'center' }}>
            <div style={{ color:'#888', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:1.5, marginBottom:5 }}>Ước tính</div>
            <div style={{ color:'#FFC107', fontSize:15, fontWeight:700 }}>{countdown || '...'}</div>
          </div>
          <div style={{ background:'#111', border:'1px solid #252525', borderRadius:11, padding:'13px 14px', textAlign:'center' }}>
            <div style={{ color:'#888', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:1.5, marginBottom:5 }}>Phiên còn lại</div>
            <div style={{
              color: sessionLeft && sessionLeft <= '05:00' ? '#ff6b6b' : '#aaa',
              fontSize:15, fontWeight:700, fontFamily:'monospace',
            }}>
              {sessionLeft || '--:--'}
            </div>
          </div>
        </div>

        {/* Live indicator */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20 }}>
          <div style={{ display:'flex', gap:4 }}>
            <span className="wr-dot" /><span className="wr-dot" /><span className="wr-dot" />
          </div>
          <span style={{ color:'#666', fontSize:12 }}>Tự động cập nhật mỗi 5 giây</span>
        </div>

        {/* Leave button */}
        <button onClick={handleLeave}
          style={{ width:'100%', padding:'13px', background:'transparent', border:'1px solid #444', borderRadius:10, color:'#888', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff4d4f88'; e.currentTarget.style.color = '#ff6b6b'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#888'; }}>
          Rời hàng chờ
        </button>

        <p style={{ textAlign:'center', color:'#666', fontSize:12, marginTop:14, lineHeight:1.7 }}>
          Vui lòng không đóng tab này. Hệ thống sẽ tự động<br/>chuyển bạn vào trang thanh toán khi đến lượt.
        </p>

      </div>
    </div>
  );
};

export default WaitingRoomPage;
