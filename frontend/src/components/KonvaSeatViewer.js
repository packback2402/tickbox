import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * KonvaSeatViewer — Unified seat grid with correct stage position layout
 *
 * Stage is rendered OUTSIDE the pan/zoom area so it always stays visible.
 * Layout is a flex container: [stage?] + [viewport] arranged by stagePosition.
 */

const SEAT_SIZE = 32;
const SEAT_GAP  = 6;

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
  // Stage is always shown at the top
  const stagePosition = 'top';
  const [displayScale, setDisplayScale] = useState(1);
  const viewRef  = useRef(null);
  const innerRef = useRef(null);
  const scaleRef = useRef(1);
  const posRef   = useRef({ x: 0, y: 0 });
  const dragRef  = useRef(null);

  const applyTransform = useCallback((s, pos) => {
    scaleRef.current = s; posRef.current = pos;
    if (innerRef.current)
      innerRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${s})`;
  }, []);

  const zoomIn    = () => { const ns = Math.min(5, scaleRef.current * 1.2); applyTransform(ns, posRef.current); setDisplayScale(ns); };
  const zoomOut   = () => { const ns = Math.max(0.3, scaleRef.current / 1.2); applyTransform(ns, posRef.current); setDisplayScale(ns); };
  const resetZoom = () => { applyTransform(1, { x: 0, y: 0 }); setDisplayScale(1); };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = viewRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const oldS = scaleRef.current, oldP = posRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newS = Math.min(5, Math.max(0.3, oldS * factor));
    const newP = { x: mx - (mx - oldP.x) * (newS / oldS), y: my - (my - oldP.y) * (newS / oldS) };
    applyTransform(newS, newP); setDisplayScale(newS);
  }, [applyTransform]);

  useEffect(() => {
    const el = viewRef.current; if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest('[data-seat]')) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
    e.currentTarget.style.cursor = 'grabbing'; e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    applyTransform(scaleRef.current, { x: d.ox + dx, y: d.oy + dy });
  }, [applyTransform]);

  const handleMouseUp = useCallback((e) => {
    dragRef.current = null;
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
  }, []);

  // ── Build unified seat lookup ─────────────────────────────────────────────
  const seatLookup = {};
  let maxCol = 0;
  const allRows = new Set();

  (sections || []).forEach(section => {
    Object.entries(section.rows || {}).forEach(([rowLabel, seats]) => {
      allRows.add(rowLabel);
      (seats || []).forEach(seat => {
        const col = seat.number;
        if (col > maxCol) maxCol = col;
        seatLookup[`${rowLabel}-${col}`] = { sectionName: section.name, seat, price: section.price };
      });
    });
  });

  const sortedRows = Array.from(allRows).sort();
  const totalCols  = maxCol;

  // ── Legend tiers ─────────────────────────────────────────────────────────
  const tierMap = {};
  (sections || []).forEach(s => {
    if (!tierMap[s.name])
      tierMap[s.name] = { name: s.name, color: getSectionColor?.(s.name) || s.color || '#2CC275', price: s.price };
  });
  const tiers = Object.values(tierMap);

  // ── Seat style helpers ────────────────────────────────────────────────────
  const isMySeat = (seat) => holdInfo?.seats?.some(s => s.id === seat.id) || false;
  const isSeatClickable = (seat) => seat && seat.status !== 'sold' && seat.status !== 'held' && !isMySeat(seat);

  const emptyCellStyle = {
    width: SEAT_SIZE, height: SEAT_SIZE, borderRadius: 6,
    background: '#1a2a1a', border: '1px solid #263326',
    color: '#3a4a3a', fontSize: 9, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, cursor: 'default',
  };

  const getFilledStyle = (seat, secColor) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    const isBlocked  = seat.status === 'sold' || seat.status === 'held';
    const isMine     = isMySeat(seat);
    let bg = secColor, border = `2px solid ${secColor}`, color = '#fff', cursor = 'pointer', shadow = 'none', opacity = 1;
    if (isSelected)  { bg = '#2CC275'; border = '2px solid #1a8a4a'; shadow = '0 0 10px #2CC27560'; }
    else if (isBlocked) { bg = '#3a3a3a'; border = '2px solid #555'; color = '#777'; cursor = 'not-allowed'; opacity = 0.85; }
    else if (isMine) { bg = '#FFD700'; border = '2px solid #aa9000'; color = '#333'; }
    return {
      width: SEAT_SIZE, height: SEAT_SIZE, borderRadius: 6,
      background: bg, border, color, cursor, opacity,
      fontSize: 9, fontWeight: 800, boxShadow: shadow,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'background 0.12s, box-shadow 0.12s',
      userSelect: 'none', WebkitUserSelect: 'none',
      position: 'relative', overflow: 'hidden',
    };
  };

  const fmt = n => new Intl.NumberFormat('vi-VN').format(n);
  const viewportHeight = Math.max(450, Math.min(700, containerWidth * 0.7));

  // ── Stage bar (rendered OUTSIDE pan/zoom) ─────────────────────────────────
  const isVertical = stagePosition === 'left' || stagePosition === 'right';

  const StageBar = () => {
    if (stagePosition === 'none') return null;
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        ...(isVertical
          ? { paddingRight: stagePosition === 'left' ? 16 : 0, paddingLeft: stagePosition === 'right' ? 16 : 0 }
          : { paddingBottom: stagePosition === 'top' ? 16 : 0, paddingTop: stagePosition === 'bottom' ? 16 : 0 }),
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #2CC275, #1a8a4a)',
          color: '#fff',
          fontWeight: 900,
          letterSpacing: 4,
          fontSize: 14,
          boxShadow: '0 4px 24px rgba(44,194,117,0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isVertical ? '60px 12px' : '14px 60px',
          borderRadius: stagePosition === 'top'    ? '0 0 40px 40px'
            : stagePosition === 'bottom' ? '40px 40px 0 0'
            : stagePosition === 'left'   ? '0 40px 40px 0'
            : '40px 0 0 40px',
          writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
          transform: stagePosition === 'left' ? 'rotate(180deg)' : 'none',
          userSelect: 'none',
        }}>
          SÂN KHẤU
        </div>
      </div>
    );
  };

  // ── Outer layout direction based on stagePosition ────────────────────────
  const outerFlexDir = stagePosition === 'left'   ? 'row'
    : stagePosition === 'right'  ? 'row-reverse'
    : stagePosition === 'bottom' ? 'column-reverse'
    : 'column'; // top (default)

  return (
    <div style={{
      display: 'flex',
      flexDirection: outerFlexDir,
      alignItems: isVertical ? 'stretch' : 'center',
      width: '100%',
      borderRadius: 14,
      background: '#0a0a0a',
      border: '1px solid #1a1a1a',
      overflow: 'hidden',
    }}>
      {/* Stage bar - always visible, outside pan/zoom */}
      <StageBar />

      {/* Pan/zoom canvas */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        {/* Zoom controls */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={zoomIn}    style={zoomBtnStyle} title="Phóng to">+</button>
          <button onClick={resetZoom} style={{ ...zoomBtnStyle, fontSize: 10 }} title="Reset zoom">
            {Math.round(displayScale * 100)}%
          </button>
          <button onClick={zoomOut}   style={zoomBtnStyle} title="Thu nhỏ">−</button>
        </div>


        {/* Hint */}
        {displayScale < 1.3 && (
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, background: 'rgba(0,0,0,0.75)', border: '1px solid #2CC27540',
            borderRadius: 20, padding: '5px 14px', color: '#2CC275',
            fontSize: 11, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>Scroll để zoom · Kéo để di chuyển</div>
        )}

        {/* Viewport */}
        <div
          ref={viewRef}
          style={{ width: '100%', height: viewportHeight, overflow: 'hidden', cursor: 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            ref={innerRef}
            style={{ display: 'inline-block', padding: '60px 40px 40px 60px', transformOrigin: '0 0', transform: 'translate(0px, 0px) scale(1)' }}
          >
            {/* Unified seat grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: SEAT_GAP }}>
              {sortedRows.map(rowLabel => (
                <div key={rowLabel} style={{ display: 'flex', alignItems: 'center', gap: SEAT_GAP }}>
                  <span style={{ width: 20, color: '#888', fontSize: 11, fontWeight: 800, textAlign: 'right', flexShrink: 0 }}>
                    {rowLabel}
                  </span>
                  {Array.from({ length: totalCols }, (_, i) => {
                    const col   = i + 1;
                    const key   = `${rowLabel}-${col}`;
                    const entry = seatLookup[key] || null;
                    if (!entry) {
                      return <div key={key} style={emptyCellStyle}>{col}</div>;
                    }
                    const { seat, sectionName } = entry;
                    const secColor = getSectionColor?.(sectionName) || seat.color || '#2CC275';
                    return (
                      <button
                        key={key}
                        data-seat="true"
                        style={getFilledStyle(seat, secColor)}
                        title={`${sectionName} ${rowLabel}${col}${seat.status === 'sold' || seat.status === 'held' ? ' (Đã bán)' : ''}`}
                        onClick={() => { if (isSeatClickable(seat)) onSeatClick?.({ ...seat, rowLabel, section: sectionName }); }}
                      >
                        {col}
                        {(seat.status === 'sold' || seat.status === 'held') && (
                          <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            style={{
                              position: 'absolute', top: 0, left: 0,
                              width: '100%', height: '100%',
                              pointerEvents: 'none',
                            }}
                          >
                            <line x1="8" y1="8" x2="92" y2="92" stroke="#e53935" strokeWidth="14" strokeLinecap="round" />
                            <line x1="92" y1="8" x2="8" y2="92" stroke="#e53935" strokeWidth="14" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  <span style={{ width: 20, color: '#888', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {rowLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KonvaSeatViewer;
