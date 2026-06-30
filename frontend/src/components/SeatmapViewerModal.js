import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import { FaTimes, FaEdit, FaTrash, FaUsers, FaChair, FaMagic, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';


/**
 * SeatmapViewerModal — Xem trước sơ đồ đã tạo
 * Props:
 *   event       – event object (id, title, ...)
 *   onClose     – close modal
 *   onEdit      – callback to open SeatmapBuilderModal
 *   onDelete    – callback to delete seatmap
 */
const SeatmapViewerModal = ({ event, onClose, onEdit, onDelete }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const fetchSeatmap = async () => {
      try {
        const res = await api.get(`/api/events/${event.id}/seatmap`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.msg || 'Không thể tải sơ đồ');
      } finally {
        setLoading(false);
      }
    };
    fetchSeatmap();
  }, [event.id]);

  // Inject SVG zone colors after render
  useEffect(() => {
    if (!data || !data.event?.svg_layout || !svgRef.current) return;
    (data.zones || []).forEach(zone => {
      if (!zone.svg_id) return;
      const svgIds = zone.svg_id.split(',').map(s => s.trim()).filter(Boolean);
      svgIds.forEach(svgId => {
        const el = svgRef.current.querySelector(`#${CSS.escape(svgId)}`);
        if (el) {
          let available;
          if (zone.zone_type === 'seated' || zone.zone_type === 'best_available') {
            available = zone.seat_available ?? 0;
          } else {
            available = zone.capacity - (zone.sold || 0);
          }
          el.style.fill = available <= 0 ? '#444' : zone.color;
          el.style.opacity = available <= 0 ? '0.5' : '1';
        }
      });
    });
  }, [data]);

  const fmt = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

  const typeLabel = {
    zone: 'Khu vực đứng',
    mixed: 'Kết hợp (đứng + ngồi)',
    seat: 'Ghế ngồi có số',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333',
        width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid #2a2a2a', flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: '700' }}>
              Sơ đồ chỗ ngồi
            </h3>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>
              {event.title}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: '#2a2a2a', border: 'none', color: '#888', width: '36px', height: '36px',
            borderRadius: '8px', cursor: 'pointer', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><FaTimes /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
              <FaSpinner style={{ fontSize: '28px', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <div>Đang tải sơ đồ...</div>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#ff4d4f' }}>
              <FaExclamationTriangle style={{ fontSize: '28px', marginBottom: '12px' }} />
              <div>{error}</div>
            </div>
          )}

          {data && (
            <>
              {/* Type badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span style={{
                  background: '#2CC27520', color: '#2CC275', padding: '4px 12px',
                  borderRadius: '20px', fontSize: '12px', fontWeight: '700'
                }}>
                  {typeLabel[data.type] || data.type}
                </span>
                <span style={{ color: '#555', fontSize: '12px' }}>
                  {data.zones?.length || 0} khu vực
                </span>
              </div>

              {/* SVG Preview */}
              {data.event?.svg_layout && (
                <div ref={svgRef} style={{
                  background: '#0d0d0d', borderRadius: '12px', border: '1px solid #1e1e1e',
                  padding: '16px', marginBottom: '20px', overflow: 'auto', maxHeight: '400px'
                }}>
                  <div
                    dangerouslySetInnerHTML={{ __html: data.event.svg_layout }}
                    style={{ width: '100%' }}
                  />
                  <style>{`
                    div svg { max-width: 100%; height: auto; }
                  `}</style>
                </div>
              )}

              {/* Zone list */}
              <div style={{ marginBottom: '8px' }}>
                <h4 style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', margin: '0 0 12px', letterSpacing: '0.5px' }}>
                  Danh sách khu vực
                </h4>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {(data.zones || []).map((zone, idx) => {
                    const isStanding = zone.zone_type === 'standing' || (!zone.zone_type && !zone.seat_total);
                    const isSeated = zone.zone_type === 'seated';
                    const isBA = zone.zone_type === 'best_available';

                    let available, total;
                    if (isSeated || isBA) {
                      available = zone.seat_available ?? 0;
                      total = zone.seat_total ?? zone.capacity ?? 0;
                    } else {
                      total = zone.capacity || 0;
                      available = total - (zone.sold || 0);
                    }
                    const sold = total - available;

                    return (
                      <div key={zone.id || idx} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', background: '#141414', borderRadius: '10px',
                        border: '1px solid #1e1e1e',
                      }}>
                        {/* Color dot */}
                        <div style={{
                          width: '10px', height: '36px', borderRadius: '5px',
                          background: zone.color || '#4A90D9', flexShrink: 0
                        }} />

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ color: '#eee', fontSize: '14px', fontWeight: '600' }}>{zone.name}</span>
                            <span style={{
                              fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '600',
                              background: isStanding ? '#FFC10715' : isBA ? '#9b59b615' : '#1890ff15',
                              color: isStanding ? '#FFC107' : isBA ? '#9b59b6' : '#1890ff',
                            }}>
                              {isStanding && <><FaUsers style={{ fontSize: '8px', marginRight: '3px' }} />Đứng</>}
                              {isSeated && <><FaChair style={{ fontSize: '8px', marginRight: '3px' }} />Ngồi</>}
                              {isBA && <><FaMagic style={{ fontSize: '8px', marginRight: '3px' }} />Best Available</>}
                            </span>
                          </div>
                          <div style={{ color: '#555', fontSize: '11px' }}>
                            Đã bán {sold}/{total} · Còn {available}
                          </div>
                        </div>

                        {/* Price */}
                        <div style={{ color: '#2CC275', fontWeight: '700', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {fmt(zone.price)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — Actions */}
        {data && (
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #2a2a2a',
            display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0
          }}>
            <button onClick={onDelete} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', background: '#ff4d4f15', color: '#ff4d4f',
              border: '1px solid #ff4d4f40', borderRadius: '8px', cursor: 'pointer',
              fontWeight: '600', fontSize: '13px'
            }}>
              <FaTrash style={{ fontSize: '11px' }} /> Xóa sơ đồ
            </button>
            <button onClick={onEdit} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 24px', background: '#1890ff', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontWeight: '700', fontSize: '13px'
            }}>
              <FaEdit style={{ fontSize: '12px' }} /> Sửa sơ đồ
            </button>
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

export default SeatmapViewerModal;
