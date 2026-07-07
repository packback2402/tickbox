import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import {
  FaArrowLeft, FaTicketAlt, FaUsers, FaDownload,
  FaCalendarAlt, FaSearch
} from 'react-icons/fa';
import { MdAttachMoney } from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
const fmtShort = (n) => {
  const v = parseFloat(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(1) + ' tỷ';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' tr';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toLocaleString('vi-VN');
};

// ── KPI Card ────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color }) => (
  <div style={{
    background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 16,
    padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16,
    transition: 'transform .2s, box-shadow .2s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,.45)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
  >
    <div style={{
      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
      background: `${color}22`, color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 22
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{sub}</div>}
    </div>
  </div>
);

// ── Section Header ────────────────────────────────────────
const SectionHeader = ({ children }) => (
  <h3 style={{
    color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 18px 0',
    paddingBottom: 12, borderBottom: '1px solid #2a2a2a',
    display: 'flex', alignItems: 'center', gap: 8
  }}>{children}</h3>
);

// ─────────────────────────────────────────────────────────
const EventAnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Xác định đường về dashboard theo role
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const dashboardPath = user?.role === 'admin' ? '/admin' : '/organizer';

  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Guard
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      navigate('/');
    }
  }, [navigate]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, timeRes, tickRes, attRes] = await Promise.all([
        api.get(`/api/organizer/event-summary/${id}`),
        api.get(`/api/organizer/event-revenue-timeline/${id}`),
        api.get(`/api/organizer/revenue-by-ticket-type/${id}`),
        api.get(`/api/organizer/event-attendees/${id}`)
      ]);
      setSummary(sumRes.data);
      setTimeline(timeRes.data);
      setTicketTypes(tickRes.data);
      setAttendees(attRes.data);
    } catch (err) {
      setError(err.response?.data?.msg || 'Không thể tải dữ liệu sự kiện');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Export CSV ──
  const exportCSV = () => {
    if (!attendees.length) return;
    const headers = 'Mã đơn,Email,Tên,Loại vé,SL,Đơn giá,Thành tiền,Ngày mua';
    const rows = attendees.map(a =>
      `"${a.order_code}","${a.customer_email}","${a.customer_name || ''}","${a.ticket_type}",${a.quantity_ordered},${a.price_at_purchase},${a.subtotal},"${new Date(a.purchased_at).toLocaleString('vi-VN')}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendees-event-${id}.csv`;
    link.click();
  };

  // ── Filtered attendees ──
  const filtered = attendees.filter(a => {
    const q = search.toLowerCase();
    return !q || a.customer_email?.toLowerCase().includes(q)
      || a.customer_name?.toLowerCase().includes(q)
      || a.order_code?.toLowerCase().includes(q)
      || a.ticket_type?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 18 }}>
      Đang tải dữ liệu phân tích...
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#ff4d4f' }}>
      <div style={{ fontSize: 40, color: '#ff4d4f' }}>!</div>
      <p>{error}</p>
      <Link to={dashboardPath} style={{ color: '#2CC275' }}>← Quay lại Dashboard</Link>
    </div>
  );

  // ── Chart configs ──────────────────────────────────────
  const lineData = {
    labels: timeline.map(d => new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })),
    datasets: [{
      label: 'Doanh thu (VNĐ)',
      data: timeline.map(d => parseFloat(d.revenue)),
      fill: true,
      backgroundColor: 'rgba(44,194,117,.15)',
      borderColor: '#2CC275',
      pointBackgroundColor: '#2CC275',
      tension: 0.4,
      borderWidth: 2,
    }]
  };

  const TICKET_COLORS = ['#2CC275', '#1890ff', '#FFC107', '#ff4d4f', '#722ed1', '#eb2f96'];

  const doughnutData = {
    labels: ticketTypes.map(t => `${t.ticket_type} (${t.quantity_sold})`),
    datasets: [{
      data: ticketTypes.map(t => parseFloat(t.total_revenue)),
      backgroundColor: TICKET_COLORS,
      borderColor: '#1e1e1e',
      borderWidth: 2
    }]
  };

  const barData = {
    labels: ticketTypes.map(t => t.ticket_type),
    datasets: [
      {
        label: 'Đã bán',
        data: ticketTypes.map(t => parseInt(t.quantity_sold)),
        backgroundColor: 'rgba(44,194,117,.8)',
        borderRadius: 6,
        stack: 'tickets'
      },
      {
        label: 'Còn lại',
        data: ticketTypes.map(t => parseInt(t.quantity_remaining)),
        backgroundColor: 'rgba(100,100,100,.5)',
        borderRadius: 6,
        stack: 'tickets'
      }
    ]
  };

  const chartOpts = (title) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#ccc', font: { size: 12 } } },
      title: title ? { display: true, text: title, color: '#aaa', font: { size: 13 } } : { display: false },
      tooltip: { callbacks: { label: (ctx) => ctx.dataset.label?.includes('VNĐ') || ctx.chart.config.type === 'doughnut' ? `${ctx.label || ctx.dataset.label}: ${fmt(ctx.raw)}` : `${ctx.dataset.label}: ${ctx.raw}` } }
    },
    scales: { x: { ticks: { color: '#777' }, grid: { color: '#222' } }, y: { ticks: { color: '#777', callback: v => fmtShort(v) }, grid: { color: '#222' } } }
  });

  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#ccc', padding: 14, font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
    }
  };

  const s = summary;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#eee', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Nav */}
      <div style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate(dashboardPath)} style={{ background: 'transparent', border: '1px solid #333', color: '#aaa', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <FaArrowLeft /> Dashboard
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s?.title}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {s?.category_name && <span style={{ background: '#2CC27520', color: '#2CC275', padding: '2px 8px', borderRadius: 10, marginRight: 8, fontSize: 11, fontWeight: 600 }}>{s.category_name}</span>}
              <span style={{ marginRight: 8 }}>{s?.event_date ? new Date(s.event_date).toLocaleDateString('vi-VN') : '--'}</span>
              {s?.location && <span>{s.location}</span>}
            </div>
          </div>
        </div>
        <button onClick={exportCSV} style={{ background: '#1890ff', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
          <FaDownload /> Xuất CSV
        </button>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── KPI Row ─────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          <KpiCard icon={<MdAttachMoney />} label="Doanh Thu Ròng (95%)" value={fmtShort(s?.net_revenue) + ' đ'} sub={fmt(s?.net_revenue)} color="#2CC275" />
          <KpiCard icon={<FaTicketAlt />} label="Vé Đã Bán / Tổng" value={`${s?.tickets_sold} / ${s?.tickets_total}`} sub={`Tỷ lệ bán: ${s?.sell_through_rate}%`} color="#1890ff" />
          <KpiCard icon={<FaUsers />} label="Khách Hàng Unique" value={s?.unique_customers} sub="người đã mua vé" color="#FFC107" />
          <KpiCard icon={<FaCalendarAlt />} label="Tổng Doanh Thu (GMV)" value={fmtShort(s?.total_revenue) + ' đ'} sub={fmt(s?.total_revenue)} color="#ff6b6b" />
        </div>

        {/* ── Sell-through Progress Bar ─────────────────── */}
        <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, padding: '16px 24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: '#aaa', fontWeight: 600 }}>Tiến Độ Bán Vé</span>
            <span style={{ color: '#2CC275', fontWeight: 700 }}>{s?.sell_through_rate}%</span>
          </div>
          <div style={{ background: '#333', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${s?.sell_through_rate || 0}%`, background: s?.sell_through_rate >= 80 ? '#2CC275' : s?.sell_through_rate >= 50 ? '#FFC107' : '#1890ff', borderRadius: 8, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#555' }}>
            <span>{s?.tickets_sold} đã bán</span>
            <span>{(s?.tickets_total || 0) - (s?.tickets_sold || 0)} còn lại</span>
          </div>
        </div>

        {/* ── Charts Row ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 32 }}>
          {/* Line Chart */}
          <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 16, padding: 24 }}>
            <SectionHeader>Doanh Thu Theo Ngày</SectionHeader>
            {timeline.length > 0 ? (
              <div style={{ height: 280 }}>
                <Line data={lineData} options={{ ...chartOpts(), scales: { x: { ticks: { color: '#777' }, grid: { color: '#1a1a1a' } }, y: { ticks: { color: '#777', callback: v => fmtShort(v) }, grid: { color: '#222' } } } }} />
              </div>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 28, color: '#555' }}>--</div>
                <span>Chưa có giao dịch</span>
              </div>
            )}
          </div>

          {/* Doughnut Chart */}
          <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 16, padding: 24 }}>
            <SectionHeader>Doanh Thu Theo Loại Vé</SectionHeader>
            {ticketTypes.length > 0 ? (
              <div style={{ height: 280 }}>
                <Doughnut data={doughnutData} options={doughnutOpts} />
              </div>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        {/* ── Stacked Bar: Bán / Còn lại ─────────────────── */}
        {ticketTypes.length > 0 && (
          <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 16, padding: 24, marginBottom: 32 }}>
            <SectionHeader>Số Lượng Vé Theo Hạng (Bán / Còn Lại)</SectionHeader>
            <div style={{ height: 220 }}>
              <Bar data={barData} options={{ ...chartOpts(), plugins: { legend: { labels: { color: '#ccc' } } }, scales: { x: { ticks: { color: '#777' }, grid: { display: false }, stacked: true }, y: { ticks: { color: '#777' }, grid: { color: '#222' }, stacked: true } } }} />
            </div>

            {/* Ticket type detail table */}
            <div style={{ marginTop: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#161616', color: '#666', textTransform: 'uppercase', fontSize: 11 }}>
                    {['Loại vé', 'Giá gốc', 'Đã bán', 'Còn lại', 'Doanh thu'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Loại vé' ? 'left' : 'right', borderBottom: '1px solid #2a2a2a' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ticketTypes.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: TICKET_COLORS[i % TICKET_COLORS.length], display: 'inline-block' }} />
                        {t.ticket_type}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#aaa' }}>{fmt(t.unit_price)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#2CC275', fontWeight: 700 }}>{t.quantity_sold}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#666' }}>{t.quantity_remaining}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1890ff', fontWeight: 600 }}>{fmt(t.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Attendees Table ──────────────────────────────── */}
        <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <SectionHeader>Danh Sách Người Mua ({attendees.length})</SectionHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161616', border: '1px solid #333', borderRadius: 8, padding: '8px 14px' }}>
              <FaSearch style={{ color: '#555' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo email, tên, mã đơn..."
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#ccc', fontSize: 13, width: 240 }}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#555' }}>
              {attendees.length === 0 ? 'Chưa có đơn hàng nào cho sự kiện này' : 'Không tìm thấy kết quả'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#161616', color: '#555', textTransform: 'uppercase', fontSize: 11 }}>
                    {['Mã đơn', 'Khách hàng', 'Loại vé', 'SL', 'Thành tiền', 'Ngày mua'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'SL' || h === 'Thành tiền' ? 'right' : 'left', borderBottom: '1px solid #222' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #161616', transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#161616'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '12px 14px', color: '#1890ff', fontFamily: 'monospace', fontSize: 12 }}>{a.order_code}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{a.customer_name || '—'}</div>
                        <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{a.customer_email}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#2CC27520', color: '#2CC275', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{a.ticket_type}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#FFC107', fontWeight: 700 }}>{a.quantity_ordered}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#2CC275', fontWeight: 600 }}>{fmt(a.subtotal)}</td>
                      <td style={{ padding: '12px 14px', color: '#555', fontSize: 12 }}>
                        {new Date(a.purchased_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#161616', fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: '12px 14px', color: '#aaa', fontSize: 12 }}>TỔNG ({filtered.length} đơn)</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#FFC107' }}>
                      {filtered.reduce((s, a) => s + parseInt(a.quantity_ordered), 0)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#2CC275' }}>
                      {fmt(filtered.reduce((s, a) => s + parseFloat(a.subtotal), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default EventAnalyticsPage;
