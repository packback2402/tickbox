import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * SeatGridViewer — Pure HTML/CSS seat map (no Konva)
 *
 * Lý do bỏ Konva: Konva's internal click-detection bị reset bởi React reconciler
 * mỗi khi setPosition() được gọi trong onMouseMove → Circle.onClick không fire.
 *
 * Giải pháp: DOM <button> elements (click luôn tin cậy) + CSS transform cho pan/zoom.
 * Pan/zoom dùng imperative DOM update (không qua React state) để tránh re-render
 * trong lúc drag → button click không bị ảnh hưởng.
 */

const SEAT_SIZE = 28;       // px (width & height của mỗi ô ghế)
const SEAT_GAP = 8;         // px gap giữa các ghế
const AISLE_WIDTH = 24;     // px lối đi giữa

const zoomBtnStyle = {
  width: 30, height: 30, borderRadius: '50%',
  background: '#222', border: '1px solid #444',
  color: '#2CC275', cursor: 'pointer',
  fontSize: 16, fontWeight: 'bold', lineHeight: '1',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, flexShrink: 0,
};

const KonvaSeatViewer = ({
  sections,
  selectedSeats = [],
  holdInfo,
  onSeatClick,
  getSectionColor,
  containerWidth = 800,
}) => {
  // Chỉ dùng React state để hiển thị % zoom trên nút — không dùng cho pan/zoom thật
  const [displayScale, setDisplayScale] = useState(1);

  const viewRef  = useRef(null);  // viewport div (overflow: hidden)
  const innerRef = useRef(null);  // nội dung pan/zoom
  const scaleRef = useRef(1);
  const posRef   = useRef({ x: 0, y: 0 });
  const dragRef  = useRef(null);

  // ─── Imperative transform (không trigger React re-render) ─────────────────
  const applyTransform = useCallback((s, pos) => {
    scaleRef.current = s;
    posRef.current = pos;
    if (innerRef.current) {
      innerRef.current.style.transform =
        `translate(${pos.x}px, ${pos.y}px) scale(${s})`;
    }
  }, []);

  // ─── Wheel zoom tại vị trí chuột ──────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = viewRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const oldS = scaleRef.current;
    const oldP = posRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newS = Math.min(5, Math.max(0.3, oldS * factor));
    const newP = {
      x: mx - (mx - oldP.x) * (newS / oldS),
      y: my - (my - oldP.y) * (newS / oldS),
    };
    applyTransform(newS, newP);
    setDisplayScale(newS); // chỉ cập nhật nút hiển thị %
  }, [applyTransform]);

  // Gắn wheel listener non-passive để preventDefault hoạt động
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ─── Pan (drag) ────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Nếu click vào ô ghế (button[data-seat]), không bắt đầu pan
    if (e.target.closest && e.target.closest('[data-seat]')) return;
    dragRef.current = {
      sx: e.clientX, sy: e.clientY,
      ox: posRef.current.x, oy: posRef.current.y,
      moved: false,
    };
    e.currentTarget.style.cursor = 'grabbing';
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return; // dead zone
    d.moved = true;
    applyTransform(scaleRef.current, { x: d.ox + dx, y: d.oy + dy });
  }, [applyTransform]);

  const handleMouseUp = useCallback((e) => {
    dragRef.current = null;
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
  }, []);

  // ─── Zoom buttons ──────────────────────────────────────────────────────────
  const zoomIn = () => {
    const newS = Math.min(5, scaleRef.current * 1.25);
    applyTransform(newS, posRef.current);
    setDisplayScale(newS);
  };
  const zoomOut = () => {
    const newS = Math.max(0.3, scaleRef.current / 1.25);
    applyTransform(newS, posRef.current);
    setDisplayScale(newS);
  };
  const resetZoom = () => {
    applyTransform(1, { x: 0, y: 0 });
    setDisplayScale(1);
  };

  // ─── Seat helpers ──────────────────────────────────────────────────────────
  const isSeatClickable = (seat) => {
    if (seat.status === 'sold' || seat.status === 'held') return false;
    if (holdInfo && !selectedSeats.some((s) => s.id === seat.id)) return false;
    return true;
  };

  const getSeatStyle = (seat) => {
    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    const isBlocked = seat.status === 'sold' || seat.status === 'held';
    const isMine = seat.status === 'mine';
    let bg = '#ffffff';
    let border = '1.5px solid #aaa';
    let color = '#333';
    let shadow = 'none';
    let cursor = 'pointer';
    if (isSelected) {
      bg = '#2CC275'; border = '2px solid #1a8a4a'; color = '#fff';
      shadow = '0 0 8px #2CC27570';
    } else if (isBlocked) {
      bg = '#ff4d4f'; border = '1.5px solid #cc2222'; color = '#fff'; cursor = 'not-allowed';
    } else if (isMine) {
      bg = '#FFD700'; border = '1.5px solid #aa9000'; color = '#333';
    }
    return {
      width: SEAT_SIZE, height: SEAT_SIZE, borderRadius: '50%',
      background: bg, border, color, cursor,
      fontSize: 9, fontWeight: 800,
      padding: 0, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: shadow,
      transition: 'background 0.12s, box-shadow 0.12s',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    };
  };

  const fmt = (n) =>
    new Intl.NumberFormat('vi-VN').format(n);

  const viewportHeight = Math.max(450, Math.min(700, containerWidth * 0.7));

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 14, background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
      {/* ── Zoom controls ── */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={zoomIn} style={zoomBtnStyle} title="Phóng to">+</button>
        <button onClick={resetZoom} style={{ ...zoomBtnStyle, fontSize: 10 }} title="Reset zoom">
          {Math.round(displayScale * 100)}%
        </button>
        <button onClick={zoomOut} style={zoomBtnStyle} title="Thu nhỏ">−</button>
      </div>

      {/* ── Hint ── */}
      {displayScale < 1.3 && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: 'rgba(0,0,0,0.75)', border: '1px solid #2CC27540',
          borderRadius: 20, padding: '5px 14px', color: '#2CC275',
          fontSize: 11, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Scroll để zoom · Kéo để di chuyển
        </div>
      )}

      {/* ── Viewport ── */}
      <div
        ref={viewRef}
        style={{
          width: '100%', height: viewportHeight,
          overflow: 'hidden', cursor: 'grab',
          borderRadius: 14,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Pan/zoom inner container (transform applied imperatively) ── */}
        <div
          ref={innerRef}
          style={{
            display: 'block',
            padding: '60px 40px 40px',
            transformOrigin: '0 0',
            transform: 'translate(0px, 0px) scale(1)',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          {/* Stage label */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{
              background: '#b0b0b0', padding: '8px 60px',
              borderRadius: '0 0 40px 40px', color: '#222',
              fontWeight: 900, letterSpacing: 4, fontSize: 14,
              display: 'inline-block',
            }}>
              STAGE
            </span>
          </div>

          {/* ── Sections ── */}
          {sections.map((section) => {
            const rowLabels = Object.keys(section.rows || {}).sort();
            const sectionColor = getSectionColor?.(section.name) || section.color || '#2CC275';

            return (
              <div
                key={section.name}
                style={{
                  background: sectionColor,
                  borderRadius: 6,
                  padding: '14px 16px 12px',
                  marginBottom: 12,
                  display: 'block',
                  width: 'max-content',
                  boxSizing: 'border-box',
                }}
              >
                {/* Section name */}
                <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: 1, marginBottom: 10 }}>
                  {section.name}
                </div>

                {/* Rows */}
                {rowLabels.map((rowLabel) => {
                  const seats = section.rows[rowLabel] || [];
                  const rowHasAisle = seats.length > 6;
                  const aisleIdx = rowHasAisle ? Math.floor(seats.length / 2) : seats.length;
                  const leftSeats  = seats.slice(0, aisleIdx);
                  const rightSeats = rowHasAisle ? seats.slice(aisleIdx) : [];

                  return (
                    <div
                      key={rowLabel}
                      style={{ display: 'flex', alignItems: 'center', gap: SEAT_GAP, marginBottom: 6 }}
                    >
                      {/* Left row label */}
                      <span style={{ width: 22, color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 800, flexShrink: 0, textAlign: 'right', display: 'inline-block' }}>
                        {rowLabel}
                      </span>

                      {/* Left seats */}
                      <div style={{ display: 'flex', gap: SEAT_GAP }}>
                        {leftSeats.map((seat, i) => (
                          <button
                            key={seat.id != null ? seat.id : `${section.name}-${rowLabel}-L${i}`}
                            data-seat="true"
                            style={getSeatStyle(seat)}
                            title={`${section.name} ${rowLabel}${seat.number ?? i + 1}${seat.status === 'sold' || seat.status === 'held' ? ' (Đã bán)' : ''}`}
                            onClick={() => {
                              if (isSeatClickable(seat)) {
                                onSeatClick?.({ ...seat, rowLabel, section: section.name });
                              }
                            }}
                          >
                            {seat.number ?? i + 1}
                          </button>
                        ))}
                      </div>

                      {/* Aisle gap */}
                      {rowHasAisle && (
                        <div style={{ width: AISLE_WIDTH, flexShrink: 0 }} />
                      )}

                      {/* Right seats */}
                      {rightSeats.length > 0 && (
                        <div style={{ display: 'flex', gap: SEAT_GAP }}>
                          {rightSeats.map((seat, i) => (
                            <button
                              key={seat.id != null ? seat.id : `${section.name}-${rowLabel}-R${i}`}
                              data-seat="true"
                              style={getSeatStyle(seat)}
                              title={`${section.name} ${rowLabel}${seat.number ?? aisleIdx + i + 1}${seat.status === 'sold' || seat.status === 'held' ? ' (Đã bán)' : ''}`}
                              onClick={() => {
                                if (isSeatClickable(seat)) {
                                  onSeatClick?.({ ...seat, rowLabel, section: section.name });
                                }
                              }}
                            >
                              {seat.number ?? aisleIdx + i + 1}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Right row label */}
                      <span style={{ width: 22, color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 800, flexShrink: 0, display: 'inline-block' }}>
                        {rowLabel}
                      </span>
                    </div>
                  );
                })}

                {/* Price */}
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, marginTop: 8 }}>
                  {fmt(section.price)}đ / ghế
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KonvaSeatViewer;
