import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { FaSave, FaCheckCircle, FaExclamationTriangle, FaMagic, FaCalendarAlt, FaTicketAlt, FaUndo } from 'react-icons/fa';

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const fmt = (dateStr) => {
  const d = new Date(dateStr);
  return { day: DAY_NAMES[d.getDay()], date: `${d.getDate()}/${d.getMonth() + 1}` };
};

const fmtCurrency = (n) => new Intl.NumberFormat('vi-VN').format(n);

// ─── Stepper cell ──────────────────────────────────────────────────────────
const StepperCell = ({ value, onChange }) => {
  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(value + 1);

  const btnBase = {
    width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
    fontWeight: 900, fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.12s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button" onClick={dec}
        style={{ ...btnBase, background: '#252525', color: '#666' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.color = '#666'; }}
      >−</button>
      <input
        type="number" min="0" value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        onFocus={e => e.target.select()}
        style={{
          width: 46, height: 28, textAlign: 'center', fontWeight: 700, fontSize: 14,
          background: value > 0 ? '#2CC27512' : '#1a1a1a',
          border: `1.5px solid ${value > 0 ? '#2CC27550' : '#2a2a2a'}`,
          borderRadius: 6, color: value > 0 ? '#fff' : '#555', outline: 'none',
          fontFamily: 'inherit', transition: 'all 0.12s',
        }}
        onFocusCapture={e => { e.target.style.borderColor = '#2CC275'; e.target.style.background = '#2CC27518'; }}
        onBlurCapture={e => { e.target.style.borderColor = value > 0 ? '#2CC27550' : '#2a2a2a'; e.target.style.background = value > 0 ? '#2CC27512' : '#1a1a1a'; }}
      />
      <button
        type="button" onClick={inc}
        style={{ ...btnBase, background: '#2CC27518', color: '#2CC275' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#2CC27530'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#2CC27518'; }}
      >+</button>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────
const ScheduleTicketManager = ({ event, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [savedAllocations, setSavedAllocations] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/api/events/${event.id}/schedule-tickets`);
      const { schedules: s, tickets: t, allocations: a } = res.data;
      setSchedules(s);
      setTickets(t);
      const allocMap = {};
      s.forEach(sch => t.forEach(tk => { allocMap[`${sch.id}_${tk.id}`] = 0; }));
      a.forEach(al => { allocMap[`${al.schedule_id}_${al.ticket_id}`] = al.daily_quantity; });
      setAllocations(allocMap);
      setSavedAllocations({ ...allocMap });
      setIsDirty(false);
    } catch (err) {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    try {
      setLoading(true);
      setError('');
      await api.post(`/api/events/${event.id}/schedules/generate`, { start_time: '09:00', end_time: '21:00' });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.msg || err.message);
      setLoading(false);
    }
  };

  const handleChange = (scheduleId, ticketId, value) => {
    setAllocations(prev => ({ ...prev, [`${scheduleId}_${ticketId}`]: value }));
    setError('');
    setSuccess('');
    setIsDirty(true);
  };

  const handleReset = () => {
    setAllocations({ ...savedAllocations });
    setIsDirty(false);
    setError('');
    setSuccess('');
  };

  const ticketTotals = useMemo(() => {
    const t = {};
    tickets.forEach(tk => {
      t[tk.id] = schedules.reduce((s, sch) => s + (allocations[`${sch.id}_${tk.id}`] || 0), 0);
    });
    return t;
  }, [allocations, tickets, schedules]);

  const dayTotals = useMemo(() => {
    const t = {};
    schedules.forEach(s => {
      t[s.id] = tickets.reduce((sum, tk) => sum + (allocations[`${s.id}_${tk.id}`] || 0), 0);
    });
    return t;
  }, [allocations, tickets, schedules]);

  const validation = useMemo(() => {
    return tickets.map(t => {
      const total = ticketTotals[t.id] || 0;
      const required = t.quantity_total ?? t.quantity_available;
      return { ticketId: t.id, type: t.type, total, required, ok: total === required, diff: total - required };
    });
  }, [ticketTotals, tickets]);

  const allValid = validation.every(v => v.ok);

  const handleDistributeEvenly = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    const totalQty = ticket.quantity_total ?? ticket.quantity_available;
    const perDay = Math.floor(totalQty / schedules.length);
    const remainder = totalQty % schedules.length;
    const newAlloc = { ...allocations };
    schedules.forEach((s, i) => { newAlloc[`${s.id}_${ticketId}`] = perDay + (i < remainder ? 1 : 0); });
    setAllocations(newAlloc);
    setIsDirty(true);
    setError('');
    setSuccess('');
  };

  const handleDistributeAll = () => {
    const newAlloc = { ...allocations };
    tickets.forEach(ticket => {
      const totalQty = ticket.quantity_total ?? ticket.quantity_available;
      const perDay = Math.floor(totalQty / schedules.length);
      const remainder = totalQty % schedules.length;
      schedules.forEach((s, i) => { newAlloc[`${s.id}_${ticket.id}`] = perDay + (i < remainder ? 1 : 0); });
    });
    setAllocations(newAlloc);
    setIsDirty(true);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!allValid) { setError('Tổng phân bổ chưa khớp! Hãy điều chỉnh trước khi lưu.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const list = [];
      schedules.forEach(s => tickets.forEach(t => list.push({ schedule_id: s.id, ticket_id: t.id, daily_quantity: allocations[`${s.id}_${t.id}`] || 0 })));
      await api.put(`/api/events/${event.id}/schedule-tickets`, { allocations: list });
      setSavedAllocations({ ...allocations });
      setIsDirty(false);
      setSuccess('Đã lưu phân bổ vé thành công!');
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? errors.join('; ') : (err.response?.data?.msg || err.message));
    } finally {
      setSaving(false);
    }
  };

  const totalVe = tickets.reduce((s, t) => s + (t.quantity_total ?? t.quantity_available), 0);
  const totalAllocated = Object.values(allocations).reduce((s, v) => s + v, 0);
  const overallPct = totalVe > 0 ? Math.min(Math.round(totalAllocated / totalVe * 100), 100) : 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 480, padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #2CC275', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
        <p style={{ color: '#666', margin: 0 }}>Đang tải dữ liệu phân bổ vé...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  // ── No schedules ─────────────────────────────────────────────────────────
  if (schedules.length === 0) {
    const multi = event.end_date && new Date(event.end_date).toDateString() !== new Date(event.event_date).toDateString();
    return (
      <div style={S.overlay}>
        <div style={{ ...S.modal, maxWidth: 440 }}>
          <div style={S.header}>
            <div style={S.headerLeft}><FaTicketAlt style={{ color: '#2CC275' }} /><span style={S.title}>Phân Bổ Vé Theo Ngày</span></div>
            <button onClick={onClose} style={S.closeBtn}>×</button>
          </div>
          <div style={{ padding: '44px 32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: error ? '#ff4d4f15' : '#FFC10715', border: `2px solid ${error ? '#ff4d4f40' : '#FFC10740'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              {error ? <FaExclamationTriangle style={{ color: '#ff4d4f', fontSize: 24 }} /> : <FaCalendarAlt style={{ color: '#FFC107', fontSize: 24 }} />}
            </div>
            <h4 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{error ? 'Lỗi tải dữ liệu' : multi ? 'Chưa có lịch diễn' : 'Sự kiện 1 ngày'}</h4>
            <p style={{ color: '#666', fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>{error || (multi ? 'Bạn có muốn tự động tạo lịch từ ngày bắt đầu đến ngày kết thúc không?' : 'Sự kiện chỉ diễn 1 ngày, không cần phân bổ theo ngày.')}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {multi && !error && <button onClick={handleAutoGenerate} style={S.btnPrimary}><FaMagic size={12} /> Tự động tạo lịch diễn</button>}
              {error && <button onClick={fetchData} style={S.btnPrimary}><FaUndo size={11} /> Thử lại</button>}
              <button onClick={onClose} style={S.btnGhost}>Đóng</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.headerIcon}><FaTicketAlt style={{ color: '#fff', fontSize: 16 }} /></div>
            <div>
              <div style={S.title}>Phân Bổ Vé Theo Ngày</div>
              <div style={S.subtitle}>{schedules.length} ngày • {tickets.length} hạng vé • {totalVe.toLocaleString()} vé tổng cộng</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {allValid
              ? <span style={S.badgeOk}><FaCheckCircle size={11} /> Hợp lệ</span>
              : <span style={S.badgeWarn}><FaExclamationTriangle size={11} /> {validation.filter(v => !v.ok).length} lỗi</span>}
            <button onClick={onClose} style={S.closeBtn}>×</button>
          </div>
        </div>

        {/* Overall progress */}
        <div style={S.progressBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: '#555' }}>Tiến độ phân bổ tổng thể</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: allValid ? '#2CC275' : '#FFC107' }}>
              {totalAllocated.toLocaleString()} / {totalVe.toLocaleString()} ({overallPct}%)
            </span>
          </div>
          <div style={{ height: 7, background: '#252525', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: allValid ? 'linear-gradient(90deg,#2CC275,#1da562)' : 'linear-gradient(90deg,#FFC107,#ff9800)', borderRadius: 4, transition: 'width 0.35s ease' }} />
          </div>
        </div>

        {/* Toolbar */}
        <div style={S.toolbar}>
          <button onClick={handleDistributeAll} style={S.btnMagic}><FaMagic size={11} /> Phân bổ đều tất cả</button>
          {isDirty && (
            <button onClick={handleReset} style={S.btnReset} title="Đặt lại về phân bổ đã lưu">
              <FaUndo size={11} /> Đặt lại
            </button>
          )}
        </div>

        {/* Table: days across top, tickets as rows */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${200 + schedules.length * 120}px` }}>
            {/* Column headers: days */}
            <thead>
              <tr style={{ background: '#111', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ ...S.th, minWidth: 160, textAlign: 'left', position: 'sticky', left: 0, background: '#111', zIndex: 11 }}>Hạng vé</th>
                {schedules.map(s => {
                  const { day, date } = fmt(s.schedule_date);
                  return (
                    <th key={s.id} style={{ ...S.th, minWidth: 110, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#2CC275', fontWeight: 700, letterSpacing: 0.5 }}>{day}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{date}</div>
                    </th>
                  );
                })}
                <th style={{ ...S.th, minWidth: 120, textAlign: 'center', color: '#2CC275' }}>Đã phân bổ</th>
                <th style={{ ...S.th, minWidth: 80, textAlign: 'center', color: '#888' }}>Cần</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket, ti) => {
                const total = ticketTotals[ticket.id] || 0;
                const required = ticket.quantity_total ?? ticket.quantity_available;
                const sold = ticket.quantity_sold || 0;
                const isOk = total === required;
                const rowBg = ti % 2 === 0 ? '#141414' : '#111';

                return (
                  <React.Fragment key={ticket.id}>
                    {/* Ticket info row */}
                    <tr style={{ background: rowBg, borderTop: '1px solid #1e1e1e' }}>
                      <td style={{ ...S.td, position: 'sticky', left: 0, background: rowBg, zIndex: 5, borderRight: '1px solid #1e1e1e' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: isOk ? '#2CC27518' : '#FFC10715', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FaTicketAlt style={{ color: isOk ? '#2CC275' : '#FFC107', fontSize: 13 }} />
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{ticket.type}</div>
                            <div style={{ color: '#2CC275', fontSize: 12, fontWeight: 600, marginTop: 1 }}>
                              {fmtCurrency(Math.round(Number(ticket.price)))}đ
                              {sold > 0 && <span style={{ color: '#888', fontWeight: 400, marginLeft: 6 }}>• {sold} đã bán</span>}
                            </div>
                          </div>
                        </div>
                        {/* Distribute evenly button inline */}
                        <button
                          onClick={() => handleDistributeEvenly(ticket.id)}
                          style={{ marginTop: 8, background: '#a78bfa18', color: '#a78bfa', border: '1px solid #a78bfa30', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#a78bfa28'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#a78bfa18'; }}
                        >
                          <FaMagic size={9} /> Phân bổ đều
                        </button>
                      </td>

                      {/* Input cells per day */}
                      {schedules.map(s => {
                        const key = `${s.id}_${ticket.id}`;
                        const val = allocations[key] || 0;
                        return (
                          <td key={s.id} style={{ ...S.td, textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                            <StepperCell value={val} onChange={v => handleChange(s.id, ticket.id, v)} />
                          </td>
                        );
                      })}

                      {/* Total */}
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: isOk ? '#2CC275' : total > required ? '#ff6b6b' : '#FFC107' }}>
                          {total.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: isOk ? '#2CC27580' : '#888', marginTop: 2 }}>
                          {isOk ? '✓ Khớp' : total > required ? `Thừa ${total - required}` : `Thiếu ${required - total}`}
                        </div>
                      </td>
                      <td style={{ ...S.td, textAlign: 'center', color: '#555', fontWeight: 700, fontSize: 16 }}>
                        {required.toLocaleString()}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Day totals footer row */}
              <tr style={{ background: '#0d0d0d', borderTop: '2px solid #2a2a2a' }}>
                <td style={{ ...S.td, position: 'sticky', left: 0, background: '#0d0d0d', zIndex: 5, fontWeight: 700, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderRight: '1px solid #1e1e1e' }}>
                  Tổng / ngày
                </td>
                {schedules.map(s => (
                  <td key={s.id} style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: dayTotals[s.id] > 0 ? '#ccc' : '#333', fontSize: 15 }}>
                    {(dayTotals[s.id] || 0).toLocaleString()}
                  </td>
                ))}
                <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: allValid ? '#2CC275' : '#FFC107', fontSize: 16 }}>
                  {totalAllocated.toLocaleString()}
                </td>
                <td style={{ ...S.td, textAlign: 'center', color: '#555', fontWeight: 700, fontSize: 15 }}>
                  {totalVe.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Validation errors */}
        {!allValid && (
          <div style={{ padding: '10px 20px', background: '#ff4d4f08', borderTop: '1px solid #ff4d4f20', flexShrink: 0 }}>
            {validation.filter(v => !v.ok).map((v, i) => (
              <div key={i} style={{ fontSize: 13, color: '#ff7875', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <FaExclamationTriangle size={10} />
                <b>{v.type}</b>: phân bổ {v.total.toLocaleString()} / cần {v.required.toLocaleString()}
                <span style={{ color: '#555' }}>({v.diff > 0 ? `thừa ${v.diff}` : `thiếu ${Math.abs(v.diff)}`} vé)</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {error && <div style={{ padding: '10px 20px', background: '#ff4d4f12', color: '#ff7875', fontSize: 13, borderTop: '1px solid #ff4d4f20', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}><FaExclamationTriangle size={12} /> {error}</div>}
        {success && <div style={{ padding: '10px 20px', background: '#2CC27512', color: '#2CC275', fontSize: 13, borderTop: '1px solid #2CC27520', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}><FaCheckCircle size={12} /> {success}</div>}

        {/* Footer */}
        <div style={S.footer}>
          <button onClick={onClose} style={S.btnGhost}>Hủy</button>
          <button
            onClick={handleSave}
            disabled={saving || !allValid}
            style={{ ...S.btnPrimary, opacity: saving ? 0.75 : 1, cursor: !allValid || saving ? 'not-allowed' : 'pointer', background: allValid ? 'linear-gradient(135deg,#2CC275,#1da562)' : '#252525', color: allValid ? '#fff' : '#555', boxShadow: allValid ? '0 4px 14px rgba(44,194,117,0.3)' : 'none' }}
          >
            <FaSave size={13} /> {saving ? 'Đang lưu...' : 'Lưu phân bổ'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────
const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { background: '#141414', borderRadius: 20, border: '1px solid #222', width: '100%', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { padding: '16px 20px', borderBottom: '1px solid #1e1e1e', background: '#0f0f0f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcon: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#2CC275,#1da562)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' },
  subtitle: { color: '#555', fontSize: 12, marginTop: 2 },
  closeBtn: { background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  badgeOk: { background: '#2CC27520', color: '#2CC275', border: '1px solid #2CC27540', padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 },
  badgeWarn: { background: '#FFC10715', color: '#FFC107', border: '1px solid #FFC10740', padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 },
  progressBar: { padding: '12px 20px', background: '#0d0d0d', borderBottom: '1px solid #1e1e1e', flexShrink: 0 },
  toolbar: { padding: '10px 20px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  footer: { padding: '14px 20px', borderTop: '1px solid #1e1e1e', background: '#0f0f0f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  th: { padding: '12px 10px', borderBottom: '1px solid #1e1e1e', color: '#666', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' },
  td: { padding: '14px 10px', verticalAlign: 'middle' },
  btnPrimary: { background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 4px 14px rgba(44,194,117,0.25)' },
  btnGhost: { background: 'transparent', color: '#666', border: '1px solid #2a2a2a', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s' },
  btnMagic: { background: '#a78bfa18', color: '#a78bfa', border: '1px solid #a78bfa40', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'all 0.15s' },
  btnReset: { background: '#FFC10715', color: '#FFC107', border: '1px solid #FFC10740', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'all 0.15s' },
};

export default ScheduleTicketManager;
