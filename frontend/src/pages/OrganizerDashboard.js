import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import ImageUploader from '../components/ImageUploader';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { FaCalendar, FaChartBar, FaTicketAlt, FaPercentage, FaPlus, FaEdit, FaTimes, FaTrash, FaDownload, FaFilter, FaChartLine, FaArrowLeft, FaArrowRight, FaCheck, FaMapMarked, FaShieldAlt, FaEye, FaBold, FaItalic, FaUnderline, FaStrikethrough, FaListUl, FaListOl, FaQuoteLeft, FaImage, FaUndo, FaRedo, FaSearch, FaChevronDown, FaFileAlt, FaSave, FaClock, FaMapMarkerAlt, FaBan } from 'react-icons/fa';
import { MdAttachMoney } from 'react-icons/md';
import SeatmapBuilderModal from '../components/SeatmapBuilderModal';
import SeatmapViewerModal from '../components/SeatmapViewerModal';
import ScheduleTicketManager from '../components/ScheduleTicketManager';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

const StatCard = ({ icon, label, value, color }) => (
  <div style={{
    background: '#1e1e1e',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 0.3s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{
      width: '52px', height: '52px', borderRadius: '12px',
      background: `${color}20`, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '22px', flexShrink: 0
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>{value}</div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    published: { bg: '#2CC27520', color: '#2CC275', text: 'Đã xuất bản' },
    pending: { bg: '#FFC10720', color: '#FFC107', text: 'Chờ duyệt' },
    rejected: { bg: '#ff4d4f20', color: '#ff4d4f', text: 'Bị từ chối' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, padding: '4px 12px',
      borderRadius: '20px', fontSize: '12px', fontWeight: '600',
      border: `1px solid ${s.color}40`,
      whiteSpace: 'nowrap', display: 'inline-block'
    }}>{s.text}</span>
  );
};

const OrganizerDashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const [stats, setStats] = useState({ total_events: 0, total_revenue: 0, total_tickets_sold: 0, sell_through_rate: 0 });
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [ticketStats, setTicketStats] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeatmapEvent, setSelectedSeatmapEvent] = useState(null);
  const [viewerSeatmapEvent, setViewerSeatmapEvent] = useState(null);
  
  // NEW: Detailed analytics states
  const [revenueDetailed, setRevenueDetailed] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [revenueByHour, setRevenueByHour] = useState({});
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [isolatedEvent, setIsolatedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isolatedStats, setIsolatedStats] = useState({ timeline: [], ticketType: [], hour: [] });
  const [revenueByCategory, setRevenueByCategory] = useState([]);

  // Form state
  const [editingId, setEditingId] = useState(null);
  const [eventData, setEventData] = useState({
    title: '', description: '', location: '', image_url: '',
    event_date: '', end_date: '', organizer: '', category_id: ''
  });
  const [ticketRows, setTicketRows] = useState([{ type: 'Vé Thường', price: '', quantity_available: 100, max_per_order: 10 }]);
  const [deletedTicketIds, setDeletedTicketIds] = useState([]);
  const [scheduleTicketEvent, setScheduleTicketEvent] = useState(null);

  // === 4-step wizard states ===
  const [wizardStep, setWizardStep] = useState(1);
  const [hasSeatMap, setHasSeatMap] = useState(false);
  const [seatmapDone, setSeatmapDone] = useState(false);
  const [showSeatmapBuilder, setShowSeatmapBuilder] = useState(false);
  const [seatmapBuilderIsEditing, setSeatmapBuilderIsEditing] = useState(false);
  const [showSeatmapViewer, setShowSeatmapViewer] = useState(false);
  const [tempCreatedEventId, setTempCreatedEventId] = useState(null);
  const [savedStagePosition, setSavedStagePosition] = useState('top'); // stage position from DB
  // Step 4 — license
  const [licenseFiles, setLicenseFiles] = useState([]);   // File objects chưa upload
  const [licenseUrls, setLicenseUrls] = useState([]);     // URLs đã upload thành công
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [licenseNote, setLicenseNote] = useState('');
  // Step 4 — payment
  const [paymentInfo, setPaymentInfo] = useState({ accountHolder: '', accountNumber: '', bankName: '', branch: '' });
  const [wantInvoice, setWantInvoice] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState({ businessType: 'personal', fullName: '', companyName: '', taxCode: '', address: '' });
  // Draft
  const DRAFT_KEY = 'organizer_event_draft';
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  // Rich text editor
  const editorRef = useRef(null);
  const editorSyncKey = useRef(null); // tracks which event is loaded in editor
  // Events tab search/filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const formatDateForInput = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date - offset)).toISOString().slice(0, 16);
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const number = String(value).replace(/\D/g, '');
    if (number === '') return '';
    return new Intl.NumberFormat('vi-VN').format(number);
  };

  const parseCurrency = (value) => {
    if (!value) return 0;
    return parseInt(String(value).replace(/\./g, ''), 10) || 0;
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
    const csv = headers + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchIsolatedStats = async (eventId) => {
    try {
      const [timelineRes, ticketRes, hourRes] = await Promise.all([
        api.get(`/api/organizer/event-revenue-timeline/${eventId}`),
        api.get(`/api/organizer/revenue-by-ticket-type/${eventId}`),
        api.get(`/api/organizer/revenue-by-hour/${eventId}`)
      ]);
      setIsolatedStats({ timeline: timelineRes.data, ticketType: ticketRes.data, hour: hourRes.data });
    } catch (err) { console.error(err); }
  };

  // eslint-disable-next-line no-unused-vars
  const handleOpenIsolatedDashboard = (event) => {
    setIsolatedEvent(event);
    fetchIsolatedStats(event.id);
  };

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, eventsRes, categoriesRes, chartRes, detailedRes, categoryRes] = await Promise.all([
        api.get(`/api/organizer/stats?range=${dateRange}`),
        api.get('/api/organizer/my-events'),
        api.get('/api/categories'),
        api.get(`/api/organizer/revenue-chart?range=${dateRange}`),
        api.get(`/api/organizer/revenue-detailed?range=${dateRange}`),
        api.get(`/api/organizer/revenue-by-category?range=${dateRange}`)
      ]);
      setStats(statsRes.data);
      setEvents(eventsRes.data);
      setCategories(categoriesRes.data);
      setRevenueChart(chartRes.data);
      setRevenueDetailed(detailedRes.data);
      setRevenueByCategory(categoryRes.data);
      if (categoriesRes.data.length > 0 && !editingId) {
        setEventData(prev => ({ ...prev, category_id: categoriesRes.data[0].id }));
      }
      // Load ticket stats cho event đầu tiên đã published
      const publishedEvents = eventsRes.data.filter(e => e.status === 'published');
      if (publishedEvents.length > 0) {
        const firstId = publishedEvents[0].id;
        setSelectedEventId(firstId);
        const [ticketRes, hourRes] = await Promise.all([
          api.get(`/api/organizer/ticket-stats/${firstId}`),
          api.get(`/api/organizer/revenue-by-hour/${firstId}`)
        ]);
        setTicketStats(ticketRes.data);
        setRevenueByHour(prev => ({ ...prev, [firstId]: hourRes.data }));
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  }, [editingId, dateRange]);

  useEffect(() => {
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      alert("Bạn không có quyền truy cập trang này!");
      navigate('/');
      return;
    }
    fetchData();
  }, [navigate, fetchData, dateRange]); // eslint-disable-line

  const handleEventSelect = async (eventId) => {
    setSelectedEventId(eventId);
    try {
      const res = await api.get(`/api/organizer/ticket-stats/${eventId}`);
      setTicketStats(res.data);
    } catch (err) { console.error(err); }
  };

  const handleTicketChange = (index, field, value) => {
    const rows = [...ticketRows];
    if (field === 'price') {
      const raw = value.replace(/\./g, '');
      if (!isNaN(raw)) rows[index][field] = formatCurrency(raw);
    } else if (field === 'max_per_order') {
      const qty = parseInt(rows[index].quantity_available) || 1;
      const maxVal = Math.min(parseInt(value) || 1, qty);
      rows[index][field] = maxVal;
    } else if (field === 'quantity_available') {
      rows[index][field] = value;
      // Auto-adjust max_per_order if it exceeds new quantity
      const newQty = parseInt(value) || 1;
      const currentMax = parseInt(rows[index].max_per_order) || 10;
      if (currentMax > newQty) rows[index].max_per_order = newQty;
    } else {
      rows[index][field] = value;
    }
    setTicketRows(rows);
  };

  const handleRemoveTicket = (index) => {
    const ticket = ticketRows[index];
    if (ticket.id) setDeletedTicketIds([...deletedTicketIds, ticket.id]);
    setTicketRows(ticketRows.filter((_, idx) => idx !== index));
  };

  const handleEditClick = async (event) => {
    setEditingId(event.id);
    setEventData({
      title: event.title, description: event.description || '',
      location: event.location, image_url: event.image_url,
      event_date: formatDateForInput(event.event_date),
      end_date: formatDateForInput(event.end_date),
      organizer: event.organizer || '', category_id: event.category_id,
    });
    setDeletedTicketIds([]);
    setWizardStep(1);
    try {
      const tRes = await api.get(`/api/tickets/${event.id}`);
      setTicketRows(tRes.data.length > 0
        ? tRes.data.map(t => ({ id: t.id, type: t.type, price: formatCurrency(Math.round(Number(t.price))), quantity_available: t.quantity_available, max_per_order: t.max_per_order || 10 }))
        : [{ type: 'Vé Thường', price: '', quantity_available: 100, max_per_order: 10 }]
      );
      // Load Step 4 data
      const evRes = await api.get(`/api/events/${event.id}`);
      const ev = evRes.data;
      setPaymentInfo({ accountHolder: ev.bank_account_holder || '', accountNumber: ev.bank_account_number || '', bankName: ev.bank_name || '', branch: ev.bank_branch || '' });
      setWantInvoice(ev.want_invoice || false);
      setInvoiceInfo({ businessType: ev.invoice_business_type || 'personal', fullName: ev.invoice_full_name || '', companyName: ev.invoice_company_name || '', taxCode: ev.invoice_tax_code || '', address: ev.invoice_address || '' });
      setLicenseNote(ev.license_note || '');
      // Safe parse license_files (có thể là JSON string hoặc array)
      const rawLicenseFiles = ev.license_files;
      let parsedLicenseUrls = rawLicenseFiles;
      if (typeof rawLicenseFiles === 'string') {
        try { parsedLicenseUrls = JSON.parse(rawLicenseFiles); } catch { parsedLicenseUrls = []; }
      }
      setLicenseUrls(Array.isArray(parsedLicenseUrls) ? parsedLicenseUrls : []);  // Load URLs đã lưu
      setLicenseFiles([]);
      setSavedStagePosition(ev.stage_position || 'top'); // Load stage position
    } catch { setTicketRows([{ type: 'Vé Thường', price: '', quantity_available: 100, max_per_order: 10 }]); }
    // Load seatmap status
    setHasSeatMap(!!event.has_seatmap);
    setSeatmapDone(!!event.has_seatmap);
    setTempCreatedEventId(null);
    setActiveTab('create_event');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // eslint-disable-next-line no-unused-vars
  const handleCancelEdit = () => {
    resetWizard();
  };

  const resetWizard = () => {
    setEditingId(null);
    setWizardStep(1);
    setEventData({ title: '', description: '', location: '', image_url: '', event_date: '', end_date: '', organizer: '', category_id: categories.length > 0 ? categories[0].id : '' });
    setTicketRows([{ type: 'Vé Thường', price: '', quantity_available: 100 }]);
    setDeletedTicketIds([]);
    setHasSeatMap(false);
    setSeatmapDone(false);
    setShowSeatmapBuilder(false);
    setShowSeatmapViewer(false);
    setTempCreatedEventId(null);
    setLicenseFiles([]);
    setLicenseNote('');
    setLicenseUrls([]);
    setPaymentInfo({ accountHolder: '', accountNumber: '', bankName: '', branch: '' });
    setWantInvoice(false);
    setInvoiceInfo({ businessType: 'personal', fullName: '', companyName: '', taxCode: '', address: '' });
    setDraftSavedAt(null);
    localStorage.removeItem(DRAFT_KEY);
  };

  // Draft helpers
  const saveDraft = () => {
    const draft = { eventData, ticketRows, licenseNote, paymentInfo, wantInvoice, invoiceInfo, hasSeatMap, wizardStep };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setDraftSavedAt(new Date().toLocaleTimeString('vi-VN'));
  };
  const loadDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) { alert('Không có bản nháp nào được lưu!'); return; }
    const d = JSON.parse(raw);
    if (d.eventData) setEventData(d.eventData);
    if (d.ticketRows) setTicketRows(d.ticketRows);
    if (d.licenseNote !== undefined) setLicenseNote(d.licenseNote);
    if (d.paymentInfo) setPaymentInfo(d.paymentInfo);
    if (d.wantInvoice !== undefined) setWantInvoice(d.wantInvoice);
    if (d.invoiceInfo) setInvoiceInfo(d.invoiceInfo);
    if (d.hasSeatMap !== undefined) setHasSeatMap(d.hasSeatMap);
    if (d.wizardStep) setWizardStep(d.wizardStep);
    alert('Đã khôi phục bản nháp!');
  };
  useEffect(() => {
    if (!editingId && wizardStep >= 1) {
      const t = setTimeout(() => {
        const draft = { eventData, ticketRows, licenseNote, paymentInfo, wantInvoice, invoiceInfo, hasSeatMap, wizardStep };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setDraftSavedAt(new Date().toLocaleTimeString('vi-VN'));
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [eventData, ticketRows, licenseNote, paymentInfo, wantInvoice, invoiceInfo, hasSeatMap, wizardStep, editingId]); // eslint-disable-line

  // Rich text editor — active format tracking
  const [editorActiveFormats, setEditorActiveFormats] = useState({});
  const updateEditorFormats = useCallback(() => {
    try {
      const formats = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      };
      const block = document.queryCommandValue('formatBlock').toLowerCase();
      formats.blockH2 = block === 'h2';
      formats.blockH3 = block === 'h3';
      formats.blockQuote = block === 'blockquote';
      setEditorActiveFormats(formats);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    document.addEventListener('selectionchange', updateEditorFormats);
    return () => document.removeEventListener('selectionchange', updateEditorFormats);
  }, [updateEditorFormats]);

  const execCmd = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) setEventData(d => ({ ...d, description: editorRef.current.innerHTML }));
    setTimeout(updateEditorFormats, 0);
  };

  // Sync editor innerHTML when switching event (editingId changes) or resetting form
  // This avoids dangerouslySetInnerHTML which causes cursor-jump on every keystroke
  useEffect(() => {
    const syncKey = editingId ?? 'new';
    if (editorRef.current && editorSyncKey.current !== syncKey) {
      editorRef.current.innerHTML = eventData.description || '';
      editorSyncKey.current = syncKey;
    }
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also sync when description is externally cleared (resetWizard)
  useEffect(() => {
    if (editorRef.current && (eventData.description === '' || eventData.description === null)) {
      editorRef.current.innerHTML = '';
    }
  }, [eventData.description]);

  const handleSubmit = async () => {
    try {
      if (!eventData.category_id) { alert('Vui lòng chọn thể loại!'); return; }
      if (!eventData.title || !eventData.location || !eventData.event_date) { alert('Vui lòng điền đầy đủ Thông tin cơ bản!'); return; }
      const evId = editingId || tempCreatedEventId;
      const payload = {
        ...eventData,
        category_id: parseInt(eventData.category_id),
        is_featured: false,
        license_note: licenseNote,
        license_files: licenseUrls.length > 0 ? licenseUrls : undefined,
        bank_account_holder: paymentInfo.accountHolder,
        bank_account_number: paymentInfo.accountNumber,
        bank_name: paymentInfo.bankName,
        bank_branch: paymentInfo.branch,
        want_invoice: wantInvoice,
        invoice_business_type: invoiceInfo.businessType,
        invoice_full_name: invoiceInfo.fullName,
        invoice_company_name: invoiceInfo.companyName,
        invoice_tax_code: invoiceInfo.taxCode,
        invoice_address: invoiceInfo.address,
        status: 'pending',
      };

      if (evId) {
        // Update existing (edit or draft)
        await api.put(`/api/events/${evId}`, payload);
        for (const tid of deletedTicketIds) {
          try { await api.delete(`/api/tickets/${tid}`); }
          catch { /* ticket has orders */ }
        }
        for (const ticket of ticketRows) {
          const tPayload = { event_id: evId, type: ticket.type, price: parseCurrency(ticket.price), quantity_available: parseInt(ticket.quantity_available), max_per_order: parseInt(ticket.max_per_order) || 10 };
          if (ticket.id) await api.put(`/api/tickets/${ticket.id}`, tPayload);
          else await api.post('/api/tickets', tPayload);
        }
        alert('Sự kiện đã được gửi để Admin duyệt!');
      } else {
        const eventRes = await api.post('/api/events', payload);
        const newId = eventRes.data.id;
        for (const ticket of ticketRows) {
          await api.post('/api/tickets', { event_id: newId, type: ticket.type, price: parseCurrency(ticket.price), quantity_available: parseInt(ticket.quantity_available), max_per_order: parseInt(ticket.max_per_order) || 10 });
        }
        alert('Sự kiện đã được tạo và đang chờ Admin duyệt!');
      }
      fetchData();
      resetWizard();
      setActiveTab('events');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.msg || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa sự kiện này?")) return;
    try {
      await api.delete(`/api/events/${id}`);
      alert("Đã xóa sự kiện!");
      fetchData();
    } catch (err) { alert("Lỗi: " + (err.response?.data?.msg || "Không thể xóa")); }
  };

  const handleRemoveSeatmap = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xoá toàn bộ thiết lập sơ đồ và khu vực của sự kiện này? (Không thể hoàn tác)")) return;
    try {
      await api.delete(`/api/events/${id}/seatmap`);
      alert("Đã xoá sơ đồ thành công!");
      fetchData();
    } catch (err) { alert("Lỗi: " + (err.response?.data?.msg || "Không thể xoá sơ đồ")); }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '60px', color: '#aaa', fontSize: '18px' }}>Đang tải Dashboard...</div>;

  const barData = {
    labels: revenueChart.map(r => {
      const [y, m] = r.month.split('-');
      return `T${parseInt(m)}/${y}`;
    }),
    datasets: [{
      label: 'Doanh thu (VNĐ)',
      data: revenueChart.map(r => parseFloat(r.revenue)),
      backgroundColor: 'rgba(44, 194, 117, 0.7)',
      borderColor: '#2CC275',
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Doanh thu 6 tháng gần nhất', color: '#fff', font: { size: 16, weight: '600' } },
      tooltip: {
        callbacks: {
          label: (ctx) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ctx.raw)
        }
      }
    },
    scales: {
      x: { ticks: { color: '#aaa' }, grid: { color: '#333' } },
      y: {
        ticks: {
          color: '#aaa',
          callback: (v) => v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : v
        },
        grid: { color: '#333' }
      }
    }
  };

  const totalSold = ticketStats.reduce((s, t) => s + parseInt(t.sold), 0);
  const totalRemaining = ticketStats.reduce((s, t) => s + parseInt(t.remaining), 0);

  const doughnutData = {
    labels: ['Đã bán', 'Còn lại'],
    datasets: [{
      data: [totalSold, totalRemaining],
      backgroundColor: ['#2CC275', '#333'],
      borderColor: ['#2CC275', '#555'],
      borderWidth: 2,
      hoverOffset: 8
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#ccc', padding: 16, font: { size: 13 } } },
      title: { display: true, text: 'Tỷ lệ bán vé', color: '#fff', font: { size: 16, weight: '600' } }
    }
  };

  const inputStyle = { padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: 'white', width: '100%', boxSizing: 'border-box', fontSize: '15px', outline: 'none' };
  const selectStyle = { ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '14px', paddingRight: '44px' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#ccc', fontSize: '14px' };

  return (
    <>
      {/* Isolated Event Dashboard Modal */}
      {isolatedEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#1e1e1e', width: '100%', maxWidth: '1200px', height: '90vh', borderRadius: '16px', overflowY: 'auto', border: '1px solid #444', padding: '30px', position: 'relative' }}>
            <button onClick={() => setIsolatedEvent(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#aaa', fontSize: '24px', cursor: 'pointer' }}><FaTimes /></button>
            <h2 style={{ color: '#2CC275', margin: '0 0 8px 0' }}>{isolatedEvent.title}</h2>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>Không Gian Quản Trị Độc Lập (Isolated Event Dashboard)</p>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div style={{ background: '#252525', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h4 style={{ color: '#fff', marginBottom: '16px', textAlign: 'center' }}><FaChartLine /> Biểu Đồ Miền: Doanh Thu Theo Ngày</h4>
                <div style={{ height: '300px' }}>
                  <Line 
                    data={{
                      labels: isolatedStats.timeline.map(item => item.date),
                      datasets: [{
                        label: 'Doanh Thu (VNĐ)',
                        data: isolatedStats.timeline.map(item => item.revenue),
                        fill: true,
                        backgroundColor: 'rgba(44, 194, 117, 0.2)',
                        borderColor: '#2CC275',
                        tension: 0.4
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              </div>
              <div style={{ background: '#252525', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h4 style={{ color: '#fff', marginBottom: '16px', textAlign: 'center' }}><FaChartBar /> Biểu Đồ Cột: Giờ Vàng Chốt Đơn</h4>
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={{
                      labels: isolatedStats.hour.map(item => item.hour + 'h'),
                      datasets: [{
                        label: 'Số Vé Bán',
                        data: isolatedStats.hour.map(item => item.tickets_sold),
                        backgroundColor: '#1890ff',
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              <div style={{ background: '#252525', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h4 style={{ color: '#fff', marginBottom: '16px', textAlign: 'center' }}><FaTicketAlt /> Biểu Đồ Tròn: Tỷ Lệ Tẩu Tán Hạng Vé</h4>
                <div style={{ height: '300px' }}>
                  <Doughnut 
                    data={{
                      labels: isolatedStats.ticketType.map(item => item.type),
                      datasets: [{
                        data: isolatedStats.ticketType.map(item => item.total_sold),
                        backgroundColor: ['#2CC275', '#1890ff', '#faad14', '#e84118', '#8c7ae6'],
                        borderWidth: 0
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#ccc' } } } }}
                  />
                </div>
              </div>
              <div style={{ background: '#252525', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h4 style={{ color: '#fff', marginBottom: '16px' }}><FaTicketAlt /> Chi Tiết Hiệu Suất Hạng Vé</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', color: '#ccc' }}>
                  <thead>
                    <tr style={{ background: '#1a1a1a', color: '#888' }}>
                      <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>Hạng Vé</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid #333', textAlign: 'center' }}>Đã Bán</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid #333', textAlign: 'right' }}>Doanh Thu (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isolatedStats.ticketType.map((t, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '12px', fontWeight: '500', color: '#fff' }}>{t.type}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{t.total_sold}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#2CC275' }}>{Number(t.total_revenue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
    
    <div style={{ display: 'flex', minHeight: '100vh', background: '#121212', color: '#eee' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', background: '#1e1e1e', borderRight: '1px solid #333', padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ padding: '0 24px', margin: '0 0 32px 0', fontSize: '24px', fontWeight: '700', color: '#2CC275' }}>
          TiTicket <span style={{ color: '#fff', fontSize: '14px', fontWeight: '400', display: 'block', marginTop: '4px' }}>Organizer</span>
        </h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: activeTab === 'overview' ? '#2CC27520' : 'transparent', color: activeTab === 'overview' ? '#2CC275' : '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '15px', fontWeight: activeTab === 'overview' ? '600' : '500', transition: 'all 0.2s' }}
          >
            <FaChartBar /> Tổng Quan
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: activeTab === 'events' ? '#2CC27520' : 'transparent', color: activeTab === 'events' ? '#2CC275' : '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '15px', fontWeight: activeTab === 'events' ? '600' : '500', transition: 'all 0.2s' }}
          >
            <FaCalendar /> Quản Lý Sự Kiện
          </button>
          <button 
            onClick={() => { resetWizard(); setActiveTab('create_event'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: activeTab === 'create_event' ? '#2CC27520' : 'transparent', color: activeTab === 'create_event' ? '#2CC275' : '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '15px', fontWeight: activeTab === 'create_event' ? '600' : '500', transition: 'all 0.2s' }}
          >
            <FaPlus /> Sự Kiện Mới
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto', height: '100vh', boxSizing: 'border-box' }}>


      {activeTab === 'overview' && (
          <div className="tab-overview-content" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', margin: '0 0 8px 0' }}>
            <span style={{ color: '#2CC275' }}>Dashboard</span> Nhà Tổ Chức
          </h1>
          <p style={{ color: '#aaa', margin: 0, fontSize: '16px' }}>
            Xin chào, <strong style={{ color: '#fff' }}>{user?.org_name || user?.email?.split('@')[0]}</strong>
          </p>
        </div>
        <div style={{ background: '#252525', padding: '8px 16px', borderRadius: '10px', border: '1px solid #444', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaFilter color="#888" />
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ background: 'transparent', color: '#fff', border: 'none', outline: 'none', fontSize: '15px', cursor: 'pointer', fontWeight: '500' }}>
            <option value="all">Toàn thời gian</option>
            <option value="30days">30 ngày qua</option>
            <option value="7days">7 ngày qua</option>
          </select>
        </div>
      </div>


      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <StatCard icon={<FaCalendar />} label="Tổng sự kiện" value={stats.total_events} color="#2CC275" />
        <StatCard icon={<MdAttachMoney />} label="Tổng doanh thu" value={new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.total_revenue)} color="#FFC107" />
        <StatCard icon={<FaTicketAlt />} label="Vé đã bán" value={stats.total_tickets_sold} color="#1890ff" />
        <StatCard icon={<FaPercentage />} label="Tỷ lệ bán" value={`${stats.sell_through_rate}%`} color="#ff6b6b" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '40px' }}>
        {/* Bar Chart */}
        <div style={{ background: '#1e1e1e', borderRadius: '16px', padding: '24px', border: '1px solid #333', height: '360px' }}>
          {revenueChart.length > 0 ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              <div style={{ textAlign: 'center' }}>
                <FaChartBar style={{ fontSize: '48px', marginBottom: '12px' }} />
                <p>Chưa có dữ liệu doanh thu</p>
              </div>
            </div>
          )}
        </div>

        {/* Doughnut Chart */}
        <div style={{ background: '#1e1e1e', borderRadius: '16px', padding: '24px', border: '1px solid #333' }}>
          {/* Event selector */}
          <select
            value={selectedEventId || ''}
            onChange={(e) => handleEventSelect(parseInt(e.target.value))}
            style={{ ...selectStyle, marginBottom: '16px', fontSize: '13px', padding: '8px 12px' }}
          >
            {events.filter(e => e.status === 'published').map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <div style={{ height: '250px' }}>
            {ticketStats.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                Chưa có dữ liệu vé
              </div>
            )}
          </div>
        </div>
      </div>
          </div>
        )}

        {activeTab === 'create_event' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingId ? <><FaEdit color="#FFC107" /> Chỉnh sửa sự kiện</> : <><FaPlus color="#2CC275" /> Tạo sự kiện mới</>}
                </h2>
                {draftSavedAt && <div style={{ color: '#555', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><FaSave size={10} /> Tự lưu lúc {draftSavedAt}</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!editingId && <button onClick={loadDraft} style={{ background: 'transparent', border: '1px solid #2CC27540', color: '#2CC275', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><FaSave size={11} /> Khôi phục nháp</button>}
                <button onClick={() => { resetWizard(); setActiveTab('events'); }} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaTimes size={11} /> Hủy</button>
              </div>
            </div>

            {/* Step Indicator */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '28px', background: '#1a1a1a', borderRadius: '12px', padding: '6px', border: '1px solid #2a2a2a' }}>
              {[
                { step: 1, label: 'Thông tin', icon: <FaFileAlt size={12} /> },
                { step: 2, label: 'Hạng vé', icon: <FaTicketAlt size={12} /> },
                { step: 3, label: 'Sơ đồ', icon: <FaMapMarked size={12} /> },
                { step: 4, label: 'Cài đặt', icon: <FaShieldAlt size={12} /> },
              ].map(({ step, label, icon }) => (
                <button key={step} onClick={() => setWizardStep(step)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: wizardStep === step ? '#2CC275' : 'transparent',
                  color: wizardStep === step ? '#000' : wizardStep > step ? '#2CC275' : '#555',
                  fontWeight: wizardStep === step ? '700' : '500', fontSize: '13px', transition: 'all 0.2s',
                }}>
                  {wizardStep > step ? <FaCheck size={11} /> : icon} {label}
                </button>
              ))}
            </div>

            {/* ── STEP 1: Thông tin cơ bản ── */}
            {wizardStep === 1 && (
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px', marginBottom: '20px' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Thông tin cơ bản</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Tên sự kiện <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input style={inputStyle} value={eventData.title} onChange={e => setEventData({ ...eventData, title: e.target.value })} placeholder="Nhập tên sự kiện..." onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ban tổ chức <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input style={inputStyle} value={eventData.organizer} onChange={e => setEventData({ ...eventData, organizer: e.target.value })} placeholder="Tên đơn vị tổ chức..." onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Thể loại <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <select style={selectStyle} value={eventData.category_id} onChange={e => setEventData({ ...eventData, category_id: parseInt(e.target.value) })}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Địa điểm <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input style={inputStyle} value={eventData.location} onChange={e => setEventData({ ...eventData, location: e.target.value })} placeholder="Địa chỉ tổ chức sự kiện..." onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ngày bắt đầu <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input type="datetime-local" style={inputStyle} value={eventData.event_date} onChange={e => setEventData({ ...eventData, event_date: e.target.value })} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ngày kết thúc</label>
                    <input type="datetime-local" style={inputStyle} value={eventData.end_date} onChange={e => setEventData({ ...eventData, end_date: e.target.value })} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                  </div>
                  {/* Image */}
                  <div style={{ gridColumn: '1/-1' }}>
                    <ImageUploader
                      currentUrl={eventData.image_url ? (eventData.image_url.startsWith('http') ? eventData.image_url : `http://localhost:5001${eventData.image_url}`) : ''}
                      onUpload={url => setEventData({ ...eventData, image_url: url })}
                      label="Ảnh bìa sự kiện" aspectRatio={16 / 9}
                      maxSizeMB={5}
                      minWidth={1200}
                      minHeight={630}
                    />
                  </div>
                  {/* Rich text description */}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Mô tả sự kiện</label>
                    <div style={{ background: '#181818', border: '1px solid #333', borderRadius: '10px', overflow: 'hidden' }}
                      onFocusCapture={e => e.currentTarget.style.borderColor = '#2CC275'}
                      onBlurCapture={e => e.currentTarget.style.borderColor = '#333'}
                    >
                      {/* Toolbar with active states */}
                      <div style={{ display: 'flex', gap: '2px', padding: '8px 10px', borderBottom: '1px solid #252525', background: '#1e1e1e', flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                          { icon: <FaBold size={12} />, cmd: 'bold', title: 'In đậm', key: 'bold' },
                          { icon: <FaItalic size={12} />, cmd: 'italic', title: 'In nghiêng', key: 'italic' },
                          { icon: <FaUnderline size={12} />, cmd: 'underline', title: 'Gạch chân', key: 'underline' },
                          { icon: <FaStrikethrough size={12} />, cmd: 'strikeThrough', title: 'Gạch ngang', key: 'strikeThrough' },
                        ].map(({ icon, cmd, title, key }) => {
                          const isActive = editorActiveFormats[key];
                          return (
                            <button key={cmd} type="button" title={title}
                              onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                              style={{ background: isActive ? '#2CC27530' : 'transparent', border: isActive ? '1px solid #2CC27580' : '1px solid transparent', color: isActive ? '#2CC275' : '#888', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: isActive ? '700' : '400' }}>
                              {icon}
                            </button>
                          );
                        })}
                        <div style={{ width: '1px', height: '20px', background: '#333', margin: '0 2px' }} />
                        {[
                          { icon: <span style={{fontSize:'11px',fontWeight:'800',fontFamily:'monospace'}}>H2</span>, cmd: 'formatBlock', val: 'h2', title: 'Tiêu đề lớn', key: 'blockH2' },
                          { icon: <span style={{fontSize:'11px',fontWeight:'800',fontFamily:'monospace'}}>H3</span>, cmd: 'formatBlock', val: 'h3', title: 'Tiêu đề nhỏ', key: 'blockH3' },
                          { icon: <FaListUl size={12} />, cmd: 'insertUnorderedList', title: 'Danh sách gạch đầu dòng', key: 'insertUnorderedList' },
                          { icon: <FaListOl size={12} />, cmd: 'insertOrderedList', title: 'Danh sách số', key: 'insertOrderedList' },
                          { icon: <FaQuoteLeft size={12} />, cmd: 'formatBlock', val: 'blockquote', title: 'Trích dẫn', key: 'blockQuote' },
                        ].map(({ icon, cmd, val, title, key }) => {
                          const isActive = editorActiveFormats[key];
                          return (
                            <button key={key} type="button" title={title}
                              onMouseDown={e => { e.preventDefault(); execCmd(cmd, val || null); }}
                              style={{ background: isActive ? '#2CC27530' : 'transparent', border: isActive ? '1px solid #2CC27580' : '1px solid transparent', color: isActive ? '#2CC275' : '#888', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {icon}
                            </button>
                          );
                        })}
                        <div style={{ width: '1px', height: '20px', background: '#333', margin: '0 2px' }} />
                        <button type="button" title="Chèn ảnh URL"
                          onMouseDown={e => { e.preventDefault(); const u = prompt('URL ảnh:'); if (u) execCmd('insertImage', u); }}
                          style={{ background: 'transparent', border: '1px solid transparent', color: '#888', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FaImage size={12} />
                        </button>
                        <div style={{ flex: 1 }} />
                        <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('undo'); }} style={{ background: 'transparent', border: '1px solid transparent', color: '#888', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaUndo size={11} /></button>
                        <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('redo'); }} style={{ background: 'transparent', border: '1px solid transparent', color: '#888', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaRedo size={11} /></button>
                      </div>
                      <div
                        ref={editorRef} contentEditable suppressContentEditableWarning
                        onInput={e => { const html = e.currentTarget.innerHTML; setEventData(d => ({ ...d, description: html })); }}
                        onKeyUp={updateEditorFormats} onMouseUp={updateEditorFormats}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            setTimeout(() => {
                              const sel = window.getSelection();
                              if (sel && sel.rangeCount > 0) {
                                const range = sel.getRangeAt(0);
                                const tmp = document.createElement('span');
                                tmp.innerHTML = '​';
                                range.insertNode(tmp);
                                tmp.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                                if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
                              }
                            }, 10);
                          }
                        }}
                        data-placeholder="Mô tả chi tiết về sự kiện..."
                        style={{ minHeight: '180px', maxHeight: '360px', overflowY: 'auto', padding: '14px 16px 14px 32px', color: '#d4d4d4', fontSize: '14px', lineHeight: '1.75', outline: 'none', borderRadius: '0 0 10px 10px' }}
                      />
                      <style>{`
                        [contenteditable]:empty:before { content: attr(data-placeholder); color: #444; pointer-events: none; display: block; }
                        [contenteditable] h2 { color: #fff; font-size: 1.25em; font-weight: 700; margin: 14px 0 6px; border-bottom: 1px solid #2a2a2a; padding-bottom: 5px; }
                        [contenteditable] h3 { color: #e0e0e0; font-size: 1.08em; font-weight: 600; margin: 10px 0 4px; }
                        [contenteditable] blockquote { border-left: 3px solid #2CC275; padding: 8px 16px; margin: 10px 0; color: #999; background: #2CC27510; border-radius: 0 8px 8px 0; font-style: italic; }
                        [contenteditable] ul { padding-left: 1.4em; margin: 6px 0; list-style-type: disc; list-style-position: outside; }
                        [contenteditable] ol { padding-left: 1.6em; margin: 6px 0; list-style-type: decimal; list-style-position: outside; }
                        [contenteditable] li { margin: 3px 0; color: #d4d4d4; display: list-item; }
                        [contenteditable] img { max-width: 100%; border-radius: 8px; display: block; margin: 10px 0; }
                        [contenteditable] strong, [contenteditable] b { color: #fff; font-weight: 700; }
                        [contenteditable] em, [contenteditable] i { color: #d0d0d0; }
                        [contenteditable] p { margin: 6px 0; }
                      `}</style>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #2a2a2a' }}>
                  <button onClick={() => setWizardStep(2)} disabled={!eventData.title || !eventData.location || !eventData.event_date}
                    style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', opacity: (!eventData.title || !eventData.location || !eventData.event_date) ? 0.5 : 1 }}>
                    Tiếp theo <FaArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Hạng vé ── */}
            {wizardStep === 2 && (
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px', marginBottom: '20px' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Thiết lập hạng vé</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {ticketRows.map((ticket, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end', background: '#111', padding: '16px', borderRadius: '10px', border: '1px solid #2a2a2a' }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '11px' }}>Tên hạng vé</label>
                        <input style={inputStyle} value={ticket.type} onChange={e => handleTicketChange(i, 'type', e.target.value)} placeholder="VIP, Thường..." onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '11px' }}>Giá (VNĐ)</label>
                        <input style={{ ...inputStyle, color: '#2CC275', fontWeight: '700' }} value={ticket.price} placeholder="0" onChange={e => handleTicketChange(i, 'price', e.target.value)} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '11px' }}>Số lượng</label>
                        <input type="number" style={inputStyle} value={ticket.quantity_available} onChange={e => handleTicketChange(i, 'quantity_available', e.target.value)} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '11px' }}>Tối đa/đơn</label>
                        <input type="number" style={{ ...inputStyle, color: '#1890ff' }} value={ticket.max_per_order ?? 10} onChange={e => handleTicketChange(i, 'max_per_order', parseInt(e.target.value) || 1)} min={1} max={parseInt(ticket.quantity_available) || 999} onFocus={e => e.target.style.borderColor='#1890ff'} onBlur={e => e.target.style.borderColor='#444'} title="Số lượng vé tối đa mỗi đơn hàng (không được vượt quá số lượng vé)" />
                      </div>
                      {ticketRows.length > 1 && (
                        <button type="button" onClick={() => handleRemoveTicket(i)} style={{ background: '#ff4d4f20', border: '1px solid #ff4d4f60', color: '#ff4d4f', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FaTrash size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setTicketRows([...ticketRows, { type: '', price: '', quantity_available: 0, max_per_order: 10 }])}
                  style={{ background: 'transparent', color: '#2CC275', border: '1px dashed #2CC27560', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                  <FaPlus size={11} /> Thêm hạng vé
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' }}>
                  <button onClick={() => setWizardStep(1)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><FaArrowLeft size={12} /> Quay lại</button>
                  <button onClick={() => setWizardStep(3)} style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>Tiếp theo <FaArrowRight /></button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Sơ đồ chỗ ngồi ── */}
            {wizardStep === 3 && (
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px', marginBottom: '20px' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>Thiết lập sơ đồ chỗ ngồi (Tùy chọn)</div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { value: false, label: 'Không có sơ đồ', desc: 'Vé không có chỗ ngồi cụ thể', icon: <FaTicketAlt size={20} /> },
                    { value: true, label: 'Có sơ đồ chỗ ngồi', desc: 'Người mua chọn ghế khi đặt vé', icon: <FaMapMarked size={20} /> },
                  ].map(opt => (
                    <div key={String(opt.value)} onClick={() => { setHasSeatMap(opt.value); setSeatmapDone(false); }}
                      style={{ flex: 1, padding: '20px', borderRadius: '12px', cursor: 'pointer', border: hasSeatMap === opt.value ? '2px solid #2CC275' : '2px solid #2a2a2a', background: hasSeatMap === opt.value ? '#2CC27510' : '#252525', transition: 'all 0.2s' }}>
                      <div style={{ color: hasSeatMap === opt.value ? '#2CC275' : '#555', marginBottom: '8px' }}>{opt.icon}</div>
                      <div style={{ color: hasSeatMap === opt.value ? '#fff' : '#888', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{opt.label}</div>
                      <div style={{ color: '#555', fontSize: '12px' }}>{opt.desc}</div>
                      {hasSeatMap === opt.value && <div style={{ marginTop: '10px', color: '#2CC275', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><FaCheck size={10} /> Đã chọn</div>}
                    </div>
                  ))}
                </div>
                {hasSeatMap && (
                  <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                    {seatmapDone ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#0d1f16', border: '1px solid #2CC27530', borderRadius: '10px', padding: '16px 18px', marginBottom: '14px', textAlign: 'left' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2CC27520', border: '2px solid #2CC275', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaCheck size={16} color="#2CC275" /></div>
                          <div><div style={{ color: '#2CC275', fontWeight: '700', fontSize: '13px' }}>Sơ đồ đã được thiết lập</div><div style={{ color: '#555', fontSize: '12px' }}>Click "Xem sơ đồ" để kiểm tra và chỉnh sửa</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                          <button onClick={() => setShowSeatmapViewer(true)} style={{ background: '#2CC275', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaEye size={12} /> Xem sơ đồ</button>
                          <button onClick={() => { setSeatmapDone(false); setHasSeatMap(false); }} style={{ background: 'transparent', border: '1px solid #ff4d4f60', color: '#ff4d4f', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaTrash size={11} /> Xóa & Tạo mới</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#2CC27515', border: '2px dashed #2CC27540', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><FaMapMarked size={22} color="#2CC275" /></div>
                        {!editingId && <div style={{ background: '#FFC10715', border: '1px solid #FFC10740', borderRadius: '8px', padding: '8px 14px', marginBottom: '14px', fontSize: '12px', color: '#FFC107', display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}><FaShieldAlt size={11} /> Sự kiện sẽ được lưu nháp khi mở trình thiết lập.</div>}
                        <button onClick={async () => {
                          if (!editingId) {
                            if (!eventData.title || !eventData.event_date || !eventData.location) { alert('Vui lòng hoàn thành Step 1 trước!'); return; }
                            try {
                              const res = await api.post('/api/events', { ...eventData, category_id: parseInt(eventData.category_id), status: 'draft' });
                              const newId = res.data.id;
                              setTempCreatedEventId(newId);
                              for (const ticket of ticketRows) {
                                if (!ticket.type) continue;
                                await api.post('/api/tickets', { event_id: newId, type: ticket.type, price: parseCurrency(ticket.price), quantity_available: parseInt(ticket.quantity_available) || 0 });
                              }
                              // Reload ticketRows with IDs from DB to prevent duplicate creation on final submit
                              const tRes = await api.get(`/api/tickets/${newId}`);
                              if (tRes.data.length > 0) {
                                setTicketRows(tRes.data.map(t => ({ id: t.id, type: t.type, price: formatCurrency(Math.round(Number(t.price))), quantity_available: t.quantity_available })));
                              }
                            } catch (err) { alert('Lỗi tạo nháp: ' + (err.response?.data?.msg || err.message)); return; }
                          }
                          setShowSeatmapBuilder(true);
                        }} style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                          <FaMapMarked size={14} /> Mở Trình Thiết Lập Sơ Đồ
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* Seatmap modals */}
                {showSeatmapViewer && (editingId || tempCreatedEventId) && (
                  <SeatmapViewerModal
                    event={{ id: editingId || tempCreatedEventId, title: eventData.title }}
                    onClose={() => setShowSeatmapViewer(false)}
                  onEdit={() => { setShowSeatmapViewer(false); setShowSeatmapBuilder(true); setSeatmapBuilderIsEditing(true); }}
                    onDelete={async () => {
                      if (!window.confirm('Xóa toàn bộ sơ đồ?')) return;
                      try { await api.delete(`/api/events/${editingId || tempCreatedEventId}/seatmap`); setShowSeatmapViewer(false); setSeatmapDone(false); setHasSeatMap(false); }
                      catch (err) { alert('Lỗi: ' + (err.response?.data?.msg || err.message)); }
                    }}
                  />
                )}
                {showSeatmapBuilder && (editingId || tempCreatedEventId) && (
                  <SeatmapBuilderModal
                    event={{ id: editingId || tempCreatedEventId, title: eventData.title, stage_position: savedStagePosition }}
                    onClose={() => { setShowSeatmapBuilder(false); setSeatmapBuilderIsEditing(false); }}
                    isEditing={seatmapBuilderIsEditing}
                    onSuccess={async () => {
                      setShowSeatmapBuilder(false); setSeatmapBuilderIsEditing(false);
                      setSeatmapDone(true); setHasSeatMap(true);
                      // Sync savedStagePosition from DB after save
                      try {
                        const evId = editingId || tempCreatedEventId;
                        const r = await api.get(`/api/events/${evId}`);
                        setSavedStagePosition(r.data.stage_position || 'top');
                      } catch { /* non-blocking */ }
                    }}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' }}>
                  <button onClick={() => setWizardStep(2)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><FaArrowLeft size={12} /> Quay lại</button>
                  <button onClick={() => setWizardStep(4)} style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>Tiếp theo <FaArrowRight /></button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Cài đặt (License + Payment) ── */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
                {/* License */}
                <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px' }}>
                  <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt size={11} color="#FFC107" /> Minh chứng cấp phép</div>
                  <label style={labelStyle}>Ghi chú / thông tin cấp phép</label>
                  <textarea style={{ ...inputStyle, height: '100px', resize: 'vertical' }} placeholder="Mô tả giấy phép, cơ quan cấp phép, số giấy phép..." value={licenseNote} onChange={e => setLicenseNote(e.target.value)} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                  <div style={{ marginTop: '14px' }}>
                    <label style={labelStyle}>Tải lên file minh chứng</label>
                    <div
                      style={{ border: '2px dashed #333', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: licenseUploading ? 'not-allowed' : 'pointer', opacity: licenseUploading ? 0.7 : 1 }}
                      onClick={() => !licenseUploading && document.getElementById('org-lic-file').click()}
                    >
                      <input
                        id="org-lic-file" type="file" multiple accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files);
                          if (!files.length) return;
                          setLicenseFiles(files);
                          setLicenseUploading(true);
                          try {
                            const formData = new FormData();
                            files.forEach(f => formData.append('files', f));
                            const res = await api.post('/api/upload/license', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            setLicenseUrls(prev => [...prev, ...res.data.urls]);
                            setLicenseFiles([]);
                          } catch (err) {
                            alert('Upload thất bại: ' + (err.response?.data?.msg || err.message));
                          } finally {
                            setLicenseUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <FaFileAlt size={24} color="#555" style={{ marginBottom: '8px' }} />
                      <div style={{ color: '#555', fontSize: '13px' }}>PDF, JPG, PNG — Nhấn để chọn file</div>
                      {licenseUploading && (
                        <div style={{ marginTop: '10px', color: '#FFC107', fontSize: '13px', fontWeight: '600' }}>Đang tải lên...</div>
                      )}
                    </div>
                    {/* Hiển thị file đã upload */}
                    {licenseUrls.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {licenseUrls.map((url, i) => {
                          const filename = url.split('/').pop();
                          const isPdf = filename.toLowerCase().endsWith('.pdf');
                          // Build absolute URL: relative /uploads/... → backend host
                          const backendBase = process.env.NODE_ENV === 'production'
                            ? (process.env.REACT_APP_API_URL ?? window.location.origin)
                            : (process.env.REACT_APP_API_URL || 'http://localhost:5001');
                          const fullUrl = url.startsWith('http') ? url : `${backendBase}${url}`;
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', borderRadius: '8px', padding: '10px 14px', border: '1px solid #2a2a2a' }}>
                              <FaFileAlt size={16} color={isPdf ? '#ff6b6b' : '#2CC275'} />
                              <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#ccc', fontSize: '13px', flex: 1, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {filename}
                              </a>
                              <button
                                type="button"
                                onClick={() => setLicenseUrls(prev => prev.filter((_, idx) => idx !== i))}
                                style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}
                                title="Xóa file"
                              >✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment */}
                <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px' }}>
                  <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><MdAttachMoney size={14} color="#2CC275" /> Thông tin thanh toán</div>
                  <div style={{ background: '#111', borderRadius: '10px', padding: '16px', marginBottom: '18px', fontSize: '13px', color: '#888', lineHeight: '1.9', border: '1px solid #2a2a2a' }}>
                    TiTicket sẽ chuyển tiền bán vé đến tài khoản của bạn. Tiền bán vé (sau khi trừ phí dịch vụ cho TiTicket) sẽ vào tài khoản của bạn sau khi xác nhận sale report từ <strong style={{ color: '#ccc' }}>7 – 10 ngày</strong>. Nếu bạn muốn nhận được tiền sớm hơn, vui lòng liên hệ chúng tôi qua <a href="mailto:info@titicket.vn" style={{ color: '#2CC275', textDecoration: 'none', fontWeight: '600' }}>info@titicket.vn</a>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>Chủ tài khoản</label>
                      <input style={inputStyle} placeholder="Nguyễn Văn A" value={paymentInfo.accountHolder} onChange={e => setPaymentInfo(p => ({ ...p, accountHolder: e.target.value }))} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                    </div>
                    <div>
                      <label style={labelStyle}>Số tài khoản</label>
                      <input style={inputStyle} placeholder="1234567890" value={paymentInfo.accountNumber} onChange={e => setPaymentInfo(p => ({ ...p, accountNumber: e.target.value }))} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                    </div>
                    <div>
                      <label style={labelStyle}>Ngân hàng</label>
                      <input style={inputStyle} placeholder="Vietcombank, BIDV..." value={paymentInfo.bankName} onChange={e => setPaymentInfo(p => ({ ...p, bankName: e.target.value }))} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                    </div>
                    <div>
                      <label style={labelStyle}>Chi nhánh</label>
                      <input style={inputStyle} placeholder="Chi nhánh Hà Nội..." value={paymentInfo.branch} onChange={e => setPaymentInfo(p => ({ ...p, branch: e.target.value }))} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
                    </div>
                  </div>
                </div>

                {/* Submit footer */}
                <div style={{ background: '#FFC10715', border: '1px solid #FFC10740', borderRadius: '10px', padding: '12px 16px', color: '#FFC107', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaShieldAlt size={12} /> Sau khi gửi, sự kiện sẽ ở trạng thái <strong>"Chờ duyệt"</strong>. Admin sẽ xem xét và phê duyệt trước khi xuất bản.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <button onClick={() => setWizardStep(3)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><FaArrowLeft size={12} /> Quay lại</button>
                  <button onClick={() => { saveDraft(); }} style={{ background: 'transparent', border: '1px solid #2CC27540', color: '#2CC275', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><FaSave size={12} /> Lưu nháp</button>
                  <button onClick={handleSubmit} style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#000', border: 'none', padding: '12px 32px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(44,194,117,0.4)' }}>
                    <FaCheck size={13} /> {editingId ? 'Cập nhật & Gửi duyệt' : 'Gửi sự kiện để duyệt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EVENTS LIST ── */}
        {activeTab === 'events' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }} onClick={() => setOpenDropdownId(null)}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: '700', borderLeft: '4px solid #2CC275', paddingLeft: '12px' }}>
                Sự kiện của tôi <span style={{ color: '#555', fontWeight: '400', fontSize: '16px' }}>({events.length})</span>
              </h2>
              <button onClick={() => { resetWizard(); setActiveTab('create_event'); }}
                style={{ background: 'linear-gradient(135deg,#2CC275,#1da562)', color: '#000', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(44,194,117,0.3)' }}>
                <FaPlus size={13} /> Tạo sự kiện mới
              </button>
            </div>

            {/* Search & Filter bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '13px' }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm kiếm sự kiện..."
                  style={{ ...inputStyle, paddingLeft: '36px' }} onFocus={e => e.target.style.borderColor='#2CC275'} onBlur={e => e.target.style.borderColor='#444'} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ ...selectStyle, width: 'auto', minWidth: '160px' }}>
                <option value="all">Tất cả trạng thái</option>
                <option value="published">Đã xuất bản</option>
                <option value="pending">Chờ duyệt</option>
                <option value="rejected">Bị từ chối</option>
              </select>
            </div>

            {/* Event cards */}
            {(() => {
              const filtered = events.filter(ev => {
                const matchSearch = !searchQuery || ev.title.toLowerCase().includes(searchQuery.toLowerCase()) || ev.location?.toLowerCase().includes(searchQuery.toLowerCase());
                const matchStatus = statusFilter === 'all' || ev.status === statusFilter;
                return matchSearch && matchStatus;
              });
              if (filtered.length === 0) return (
                <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '60px', textAlign: 'center', color: '#555' }}>
                  <FaCalendar size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>{searchQuery || statusFilter !== 'all' ? 'Không tìm thấy sự kiện phù hợp' : 'Bạn chưa có sự kiện nào'}</div>
                  {!searchQuery && statusFilter === 'all' && <button onClick={() => { resetWizard(); setActiveTab('create_event'); }} style={{ background: '#2CC275', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', marginTop: '12px' }}>Tạo sự kiện đầu tiên</button>}
                </div>
              );
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filtered.map(ev => (
                    <div key={ev.id} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#2CC27530'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}>
                      {/* Thumbnail */}
                      <img src={ev.image_url?.startsWith('http') ? ev.image_url : `http://localhost:5001${ev.image_url}`} alt=""
                        style={{ width: '90px', height: '70px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                        onError={e => { e.target.src = 'https://via.placeholder.com/90x70?text=Event'; }} />
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '360px' }}>{ev.title}</div>
                          <StatusBadge status={ev.status} />
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: '#555', fontSize: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FaClock size={10} /> {new Date(ev.event_date).toLocaleDateString('vi-VN')}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FaMapMarkerAlt size={10} /> {ev.location}</span>
                          {ev.tickets_total > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2CC275' }}><FaTicketAlt size={10} /> {ev.tickets_sold}/{ev.tickets_total} vé</span>}
                          {ev.revenue > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FFC107' }}><MdAttachMoney size={12} /> {new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(ev.revenue)}đ</span>}
                        </div>
                      </div>
                      {/* Action dropdown */}
                      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenDropdownId(openDropdownId === ev.id ? null : ev.id)}
                          style={{ background: '#252525', border: '1px solid #333', color: '#ccc', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px' }}>
                          Hành động <FaChevronDown size={10} style={{ transition: 'transform 0.2s', transform: openDropdownId === ev.id ? 'rotate(180deg)' : 'rotate(0)' }} />
                        </button>
                        {openDropdownId === ev.id && (
                          <div style={{ position: 'absolute', right: 0, top: '110%', background: '#1e1e1e', border: '1px solid #333', borderRadius: '10px', minWidth: '190px', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                            {[
                              { label: 'Chỉnh sửa', icon: <FaEdit size={12} />, color: '#2CC275', action: () => { handleEditClick(ev); setOpenDropdownId(null); } },
                              { label: ev.has_seatmap ? 'Xem sơ đồ' : 'Tạo sơ đồ', icon: <FaMapMarked size={12} />, color: '#fff', action: () => { ev.has_seatmap ? setViewerSeatmapEvent(ev) : setSelectedSeatmapEvent(ev); setOpenDropdownId(null); } },
                              { label: 'Analytics', icon: <FaChartBar size={12} />, color: '#fff', action: () => { navigate(`/organizer/event/${ev.id}/analytics`); setOpenDropdownId(null); } },
                              ...(ev.end_date && new Date(ev.end_date).toDateString() !== new Date(ev.event_date).toDateString() ? [
                                { label: 'Phân bổ vé', icon: <FaTicketAlt size={12} />, color: '#fff', action: () => { setScheduleTicketEvent(ev); setOpenDropdownId(null); } },
                              ] : []),
                              { label: 'Xóa sự kiện', icon: <FaTrash size={12} />, color: '#ff4d4f', action: () => { handleDelete(ev.id); setOpenDropdownId(null); } },
                            ].map(({ label, icon, color, action }) => (
                              <button key={label} onClick={action}
                                style={{ width: '100%', background: 'none', border: 'none', color, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', textAlign: 'left', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#252525'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                {icon} {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Detailed analytics section */}
            <div style={{ marginTop: '40px' }}>
              <button onClick={() => setShowDetailedAnalytics(!showDetailedAnalytics)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#2CC275', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', marginBottom: '20px' }}>
                <FaChartBar /> {showDetailedAnalytics ? 'Ẩn Phân Tích Chi Tiết' : 'Xem Phân Tích Chi Tiết'}
              </button>
              {showDetailedAnalytics && (
                <div style={{ background: '#1e1e1e', padding: '28px', borderRadius: '14px', border: '1px solid #333', marginBottom: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
                    <h3 style={{ color: '#2CC275', margin: 0, fontSize: '16px' }}><FaChartBar /> Phân Tích Chi Tiết Doanh Thu</h3>
                    <button onClick={() => exportToCSV(revenueDetailed, 'DoanhThu_ChiTiet')} style={{ background: '#252525', color: '#ccc', border: '1px solid #333', padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px' }}><FaDownload /> Xuất CSV</button>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #333' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#141414', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#1e1e1e', color: '#555', textTransform: 'uppercase', fontSize: '11px' }}>
                          {['Sự Kiện', 'Đơn Hàng', 'Vé Bán', 'Doanh Thu', 'Giá TB'].map(h => <th key={h} style={{ padding: '10px 14px', fontWeight: '600', textAlign: h === 'Sự Kiện' ? 'left' : 'center' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {revenueDetailed.length > 0 ? revenueDetailed.map(ev => (
                          <tr key={ev.event_id} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '12px 14px', fontWeight: '600', color: '#fff' }}>{ev.event_title}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: '#aaa' }}>{ev.total_orders}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: '#2CC275' }}>{ev.total_tickets_sold}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: '#FFC107', fontWeight: '700' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ev.total_revenue)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: '#aaa' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ev.avg_ticket_price)}</td>
                          </tr>
                        )) : <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Không có dữ liệu</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {selectedSeatmapEvent && (
        <SeatmapBuilderModal
          event={selectedSeatmapEvent}
          onClose={() => setSelectedSeatmapEvent(null)}
          onSuccess={() => {
            setSelectedSeatmapEvent(null);
            fetchData();
          }}
        />
      )}

      {scheduleTicketEvent && (
        <ScheduleTicketManager
          event={scheduleTicketEvent}
          onClose={() => setScheduleTicketEvent(null)}
          onSuccess={() => {
            setScheduleTicketEvent(null);
            fetchData();
          }}
        />
      )}

      {viewerSeatmapEvent && (
        <SeatmapViewerModal
          event={viewerSeatmapEvent}
          onClose={() => setViewerSeatmapEvent(null)}
          onEdit={() => {
            const ev = viewerSeatmapEvent;
            setViewerSeatmapEvent(null);
            setSelectedSeatmapEvent(ev);
          }}
          onDelete={async () => {
            const evId = viewerSeatmapEvent.id;
            setViewerSeatmapEvent(null);
            await handleRemoveSeatmap(evId);
          }}
        />
      )}
      </div>
    </div>
    </>
  );
};

// eslint-disable-next-line no-unused-vars
const thStyle = { padding: '14px 16px', fontWeight: '600' };
// eslint-disable-next-line no-unused-vars
const tdStyle = { padding: '14px 16px', verticalAlign: 'middle' };

export default OrganizerDashboard;
