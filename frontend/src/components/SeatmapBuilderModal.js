import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FaTimes, FaSave, FaSpinner, FaEraser, FaUndo, FaMousePointer, FaUsers, FaUpload, FaCheckCircle, FaChair, FaExclamationTriangle, FaMagic, FaInfoCircle, FaArrowRight, FaLink, FaUnlink, FaLock, FaEdit } from 'react-icons/fa';
import { MdGridOn, MdPalette } from 'react-icons/md';
import api from '../api';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_ROWS = 26;
const MAX_COLS = 60;
const DEFAULT_TIER_COLORS = ['#E74C3C', '#E67E22', '#2ECC71', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12', '#E91E63'];
const cellKey = (r, c) => `${r}_${c}`;

// ─── Input style ───────────────────────────────────────────────
const inp = {
  padding: '10px 14px', borderRadius: '8px', border: '1px solid #2a2a2a',
  background: '#0d0d0d', color: '#eee', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

/**
 * SeatmapBuilderModal — Venue-Driven
 *
 * Zone   → SVG upload → click shape → standing zone form
 * Seat   → Grid size → Paint canvas (per-seat colors)
 * Mixed  → SVG upload → click shape → popup với 2 lựa chọn:
 *            Standing: nhập sức chứa
 *            Seated:   nhập rows × cols (gen seats ngầm)
 */
const SeatmapBuilderModal = ({ event, onClose, onSuccess }) => {
  const [mode, setMode] = useState(null); // 'zone' | 'seat' | 'mixed'

  // ── Seat-mode state ─────────────────────────────────────────
  const [gridRows, setGridRows] = useState(10);
  const [gridCols, setGridCols] = useState(15);
  const [gridReady, setGridReady] = useState(false);
  const [tiers, setTiers] = useState([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [activeTier, setActiveTier] = useState(null);
  const [cellMap, setCellMap] = useState({});
  const [tool, setTool] = useState('paint');
  const [history, setHistory] = useState([]);
  const [isPainting, setIsPainting] = useState(false);
  const [customRowMode, setCustomRowMode] = useState(false);
  const [customRows, setCustomRows] = useState([]); // [{label, seats, startSeat}]

  // ── Quick Create mode ─────────────────────────────────────────
  const [quickCreateMode, setQuickCreateMode] = useState(false);
  const [quickSections, setQuickSections] = useState([
    { name: 'KHU A', rows: 2, seatsPerRow: 24, price: '', color: DEFAULT_TIER_COLORS[0] },
  ]);

  // ── SVG-based zone state (zone mode + mixed mode) ───────────
  const [svgContent, setSvgContent] = useState('');
  const [zones, setZones] = useState([]); // array of mapped zones
  const [selectedElementId, setSelectedElementId] = useState(null);
  // editZone for zone mode
  const [editZone, setEditZone] = useState(null);
  // editMixedZone for mixed mode: includes zone_type + optional rows/cols
  const [editMixedZone, setEditMixedZone] = useState(null);
  const svgContainerRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // ── Event tickets reference (fetched once on mount) ────────
  const [eventTickets, setEventTickets] = useState([]);
  const [eventTicketsLoading, setEventTicketsLoading] = useState(true);
  useEffect(() => {
    const fetchEventTickets = async () => {
      try {
        const res = await api.get(`/api/tickets/${event.id}`);
        setEventTickets(res.data.map((t, i) => ({
          id: t.id, name: t.type,
          price: parseFloat(t.price),
          quantity: parseInt(t.quantity_available || 0),
          color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
        })));
      } catch (e) { /* OK if no tickets yet */ }
      finally { setEventTicketsLoading(false); }
    };
    fetchEventTickets();
  }, [event.id]);

  // ── Load ticket tiers ────────────────────────────────────────
  const loadTiers = useCallback(async () => {
    setLoadingTiers(true);
    try {
      const res = await api.get(`/api/tickets/${event.id}`);
      const loaded = res.data.map((t, i) => ({
        id: t.id, name: t.type,
        price: parseFloat(t.price),
        quantity: parseInt(t.quantity_available || 0),
        color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
      }));
      setTiers(loaded);
      if (loaded.length > 0) setActiveTier(loaded[0]);
    } catch (e) { alert('Không thể tải hạng vé'); }
    finally { setLoadingTiers(false); }
  }, [event.id]);

  const initGrid = () => {
    if (customRowMode) {
      if (customRows.length === 0) { alert('Thêm ít nhất 1 hàng ghế!'); return; }
    } else {
      if (gridRows < 1 || gridCols < 1) return;
    }
    setCellMap({}); setHistory([]); setGridReady(true); loadTiers();
  };

  // Custom row helpers
  const addCustomRow = () => {
    const nextLabel = ROW_LABELS[customRows.length] || String.fromCharCode(65 + customRows.length);
    setCustomRows(prev => [...prev, { label: nextLabel, seats: 20, startSeat: 1 }]);
  };
  const removeCustomRow = (i) => setCustomRows(prev => prev.filter((_, idx) => idx !== i));
  const updateCustomRow = (i, field, val) => setCustomRows(prev => {
    const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n;
  });
  const paintCellByKey = (rowLabel, seatNum) => {
    const key = cellKey(rowLabel, seatNum);
    setCellMap(prev => {
      if (tool === 'paint' && activeTier && prev[key] && prev[key].tier === activeTier.name) return prev;
      if (tool === 'eraser' && prev[key] === 'disabled') return prev;
      const next = { ...prev };
      if (tool === 'eraser') { next[key] = 'disabled'; }
      else if (tool === 'paint' && activeTier) {
        const currentUsage = Object.values(prev).filter(c => c && c !== 'disabled' && c.tier === activeTier.name).length;
        if (currentUsage >= activeTier.quantity) {
          setToastMessage(`Hạng "${activeTier.name}" đã đạt giới hạn ${activeTier.quantity} ghế!`);
          setTimeout(() => setToastMessage(null), 3000);
          return prev;
        }
        next[key] = { tier: activeTier.name, price: activeTier.price, color: activeTier.color };
      }
      return next;
    });
  };

  // ── Paint helpers ────────────────────────────────────────────
  const paintCell = useCallback((rowIdx, colIdx) => {
    const key = cellKey(ROW_LABELS[rowIdx], colIdx + 1);
    setCellMap(prev => {
      if (tool === 'paint' && activeTier && prev[key] && prev[key].tier === activeTier.name) return prev;
      if (tool === 'eraser' && prev[key] === 'disabled') return prev;

      const next = { ...prev };
      if (tool === 'eraser') { next[key] = 'disabled'; }
      else if (tool === 'paint' && activeTier) { 
        const currentUsage = Object.values(prev).filter(c => c && c !== 'disabled' && c.tier === activeTier.name).length;
        if (currentUsage >= activeTier.quantity) {
          // Show toast warning
          setToastMessage(`Hạng "${activeTier.name}" đã đạt giới hạn ${activeTier.quantity} ghế!`);
          setTimeout(() => setToastMessage(null), 3000);
          return prev; // Block painting if quota exceeded
        }
        next[key] = { tier: activeTier.name, price: activeTier.price, color: activeTier.color }; 
      }
      return next;
    });
  }, [tool, activeTier]);

  const commitHistory = useCallback(() => setHistory(prev => [...prev.slice(-29), cellMap]), [cellMap]);

  const handleUndo = useCallback(() => {
    setHistory(prevHist => {
      if (!prevHist.length) return prevHist;
      const lastState = prevHist[prevHist.length - 1];
      setCellMap(lastState);
      return prevHist.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  const handleCellMouseDown = (r, c, e) => { e.preventDefault(); commitHistory(); setIsPainting(true); paintCell(r, c); };
  const handleCellMouseEnter = (r, c) => { if (isPainting) paintCell(r, c); };
  const handleMouseUp = useCallback(() => setIsPainting(false), []);
  useEffect(() => { window.addEventListener('mouseup', handleMouseUp); return () => window.removeEventListener('mouseup', handleMouseUp); }, [handleMouseUp]);

  // ── SVG handlers ─────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setSvgContent(ev.target.result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')); };
    reader.readAsText(file);
  };

  // Zone-only SVG click
  const handleSvgClickZone = (e) => {
    e.stopPropagation();
    const target = e.target;
    if (!['path', 'rect', 'polygon', 'circle', 'ellipse'].includes(target.tagName?.toLowerCase())) { setSelectedElementId(null); setEditZone(null); return; }
    let elId = target.getAttribute('id'); if (!elId) { elId = `z-${Date.now()}`; target.setAttribute('id', elId); }
    if (selectedElementId) { const old = svgContainerRef.current?.querySelector(`#${CSS.escape(selectedElementId)}`); if (old) { old.style.stroke = ''; old.style.strokeWidth = ''; } }
    target.style.stroke = '#ff4d4f'; target.style.strokeWidth = '3';
    setSelectedElementId(elId);
    const existing = zones.find(z => z.svg_id === elId);
    setEditZone(existing || { svg_id: elId, name: '', price: '', capacity: '', color: '#2CC275' });
  };

  const handleSaveZone = () => {
    if (!editZone.name || !editZone.price || !editZone.capacity) { alert('Vui lòng điền đủ thông tin!'); return; }
    // Validate capacity against linked ticket
    if (editZone.linkedTicketId) {
      const linkedTicket = eventTickets.find(t => t.id === editZone.linkedTicketId);
      if (linkedTicket && parseInt(editZone.capacity) > linkedTicket.quantity) {
        alert(`Sức chứa (${editZone.capacity}) vượt quá số lượng vé "${linkedTicket.name}" đã khai báo (${linkedTicket.quantity}). Vui lòng giảm xuống hoặc bỏ liên kết.`);
        return;
      }
    }
    const el = svgContainerRef.current?.querySelector(`#${CSS.escape(selectedElementId)}`);
    if (el) { el.style.fill = editZone.color; el.style.stroke = ''; }
    setZones(prev => { const idx = prev.findIndex(z => z.svg_id === editZone.svg_id); if (idx >= 0) { const n = [...prev]; n[idx] = editZone; return n; } return [...prev, editZone]; });
    setEditZone(null); setSelectedElementId(null);
  };

  // Mixed SVG click — opens a richer popup
  const handleSvgClickMixed = (e) => {
    e.stopPropagation();
    const target = e.target;
    if (!['path', 'rect', 'polygon', 'circle', 'ellipse'].includes(target.tagName?.toLowerCase())) { setSelectedElementId(null); setEditMixedZone(null); return; }
    let elId = target.getAttribute('id'); if (!elId) { elId = `zm-${Date.now()}`; target.setAttribute('id', elId); }
    if (selectedElementId) { const old = svgContainerRef.current?.querySelector(`#${CSS.escape(selectedElementId)}`); if (old) { old.style.stroke = ''; old.style.strokeWidth = ''; } }
    target.style.stroke = '#ff4d4f'; target.style.strokeWidth = '3';
    setSelectedElementId(elId);
    const existing = zones.find(z => z.svg_id === elId);
    setEditMixedZone(existing || { svg_id: elId, name: '', price: '', color: '#4A90D9', zone_type: 'standing', capacity: '', rows: 8, cols: 12, seat_input_mode: 'total', total_seats: '' });
  };

  const handleSaveMixedZone = () => {
    if (!editMixedZone.name || !editMixedZone.price) { alert('Vui lòng nhập tên và giá vé!'); return; }
    if (editMixedZone.zone_type === 'standing' && !editMixedZone.capacity) { alert('Vui lòng nhập sức chứa!'); return; }

    const isSeatedType = editMixedZone.zone_type === 'seated' || editMixedZone.zone_type === 'best_available';
    const useTotalMode = editMixedZone.seat_input_mode === 'total';

    if (isSeatedType) {
      if (useTotalMode) {
        if (!editMixedZone.total_seats || editMixedZone.total_seats < 1) { alert('Vui lòng nhập tổng số ghế!'); return; }
      } else {
        if (!editMixedZone.rows || !editMixedZone.cols) { alert('Vui lòng nhập số hàng và số cột!'); return; }
      }
    }

    // Compute currentQty for validation
    let currentQty;
    if (editMixedZone.zone_type === 'standing') {
      currentQty = parseInt(editMixedZone.capacity) || 0;
    } else if (useTotalMode) {
      currentQty = parseInt(editMixedZone.total_seats) || 0;
    } else {
      currentQty = (editMixedZone.rows || 0) * (editMixedZone.cols || 0);
    }

    // Validate capacity against linked ticket
    if (editMixedZone.linkedTicketId) {
      const linkedTicket = eventTickets.find(t => t.id === editMixedZone.linkedTicketId);
      if (linkedTicket && currentQty > linkedTicket.quantity) {
        alert(`Số lượng (${currentQty}) vượt quá số vé "${linkedTicket.name}" đã khai báo (${linkedTicket.quantity}). Vui lòng giảm xuống hoặc bỏ liên kết.`);
        return;
      }
    }

    // If total_seats mode: auto-compute rows/cols for backend compatibility
    let dataToSave = { ...editMixedZone };
    if (isSeatedType && useTotalMode && dataToSave.total_seats) {
      const total = parseInt(dataToSave.total_seats);
      const cols = Math.min(Math.ceil(Math.sqrt(total)), 26); // roughly square, max 26 cols
      const rows = Math.ceil(total / cols);
      dataToSave.rows = rows;
      dataToSave.cols = cols;
      // Store total_seats so backend knows this is auto-distributed
      dataToSave.total_seats = total;
    }

    const el = svgContainerRef.current?.querySelector(`#${CSS.escape(selectedElementId)}`);
    if (el) { el.style.fill = dataToSave.color; el.style.stroke = ''; }
    setZones(prev => { const idx = prev.findIndex(z => z.svg_id === dataToSave.svg_id); if (idx >= 0) { const n = [...prev]; n[idx] = dataToSave; return n; } return [...prev, dataToSave]; });
    setEditMixedZone(null); setSelectedElementId(null);
  };

  const handleDeleteZone = (svg_id) => {
    setZones(prev => prev.filter(z => z.svg_id !== svg_id));
    const el = svgContainerRef.current?.querySelector(`#${CSS.escape(svg_id)}`);
    if (el) { el.removeAttribute('fill'); el.style.fill = ''; el.style.stroke = ''; }
    if (selectedElementId === svg_id) { setSelectedElementId(null); setEditZone(null); setEditMixedZone(null); }
  };

  // ── Seat stats ───────────────────────────────────────────────
  const seatStats = (() => {
    const stats = {}; let total = 0, disabled = 0, unpainted = 0;
    if (customRowMode && customRows.length > 0) {
      customRows.forEach(({ label, seats, startSeat }) => {
        for (let s = startSeat; s < startSeat + seats; s++) {
          const key = cellKey(label, s);
          const cell = cellMap[key]; total++;
          if (cell === 'disabled') disabled++;
          else if (!cell) unpainted++;
          else stats[cell.tier] = (stats[cell.tier] || 0) + 1;
        }
      });
    } else {
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const key = cellKey(ROW_LABELS[r], c + 1);
          const cell = cellMap[key]; total++;
          if (cell === 'disabled') disabled++;
          else if (!cell) unpainted++;
          else stats[cell.tier] = (stats[cell.tier] || 0) + 1;
        }
      }
    }
    return { byTier: stats, total, disabled, unpainted };
  })();

  // ── Submit seat mode ─────────────────────────────────────────
  const handleSubmitSeat = async () => {
    setLoading(true);
    try {
      const grid = [];
      if (customRowMode && customRows.length > 0) {
        customRows.forEach(({ label, seats, startSeat }) => {
          for (let s = startSeat; s < startSeat + seats; s++) {
            const key = cellKey(label, s);
            const cell = cellMap[key];
            if (cell === 'disabled') { grid.push({ row: label, col: s, disabled: true }); }
            else if (cell?.tier) { grid.push({ row: label, col: s, tier: cell.tier, price: cell.price, color: cell.color }); }
          }
        });
      } else {
        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            const row = ROW_LABELS[r]; const col = c + 1; const key = cellKey(row, col);
            const cell = cellMap[key];
            if (cell === 'disabled') { grid.push({ row, col, disabled: true }); }
            else if (cell?.tier) { grid.push({ row, col, tier: cell.tier, price: cell.price, color: cell.color }); }
          }
        }
      }
      const active = grid.filter(g => !g.disabled);
      if (!active.length) { alert('Chưa có ghế nào được phân hạng!'); setLoading(false); return; }
      await api.post(`/api/events/${event.id}/generate-seatmap`, { type: 'seat', grid });
      alert('Sơ đồ ghế đã xuất bản!'); onSuccess();
    } catch (err) { alert(err.response?.data?.msg || 'Có lỗi xảy ra'); } finally { setLoading(false); }
  };

  // ── Quick Create: auto generate grid + submit directly ──────
  const handleQuickCreate = async () => {
    // Validate
    for (const sec of quickSections) {
      if (!sec.name.trim()) { alert('Vui lòng nhập tên cho tất cả khu vực!'); return; }
      if (!sec.price) { alert(`Vui lòng nhập giá vé cho ${sec.name}!`); return; }
      if (sec.rows < 1 || sec.seatsPerRow < 1) { alert(`Số hàng/ghế không hợp lệ cho ${sec.name}!`); return; }
      // Validate against linked ticket quantity
      if (sec.linkedTicketId) {
        const linkedTicket = eventTickets.find(t => t.id === sec.linkedTicketId);
        if (linkedTicket) {
          const totalSeats = sec.rows * sec.seatsPerRow;
          if (totalSeats > linkedTicket.quantity) {
            alert(`"${sec.name}": ${totalSeats} ghế vượt quá số vé đã khai báo (${linkedTicket.quantity}). Vui lòng giảm số hàng/ghế hoặc bỏ liên kết.`);
            return;
          }
        }
      }
    }
    setLoading(true);
    try {
      // Build grid from sections
      const grid = [];
      let rowOffset = 0;
      for (const sec of quickSections) {
        const price = parseFloat(String(sec.price).replace(/\D/g, ''));
        for (let r = 0; r < sec.rows; r++) {
          const rowLabel = ROW_LABELS[rowOffset + r] || `R${rowOffset + r + 1}`;
          for (let c = 1; c <= sec.seatsPerRow; c++) {
            grid.push({ row: rowLabel, col: c, tier: sec.name, price, color: sec.color });
          }
        }
        rowOffset += sec.rows;
      }
      if (grid.length === 0) { alert('Định nghĩa khu vực trống!'); setLoading(false); return; }
      // Also create ticket tiers (via existing API)
      for (const sec of quickSections) {
        const price = parseFloat(String(sec.price).replace(/\D/g, ''));
        const qty = sec.rows * sec.seatsPerRow;
        try {
          await api.post(`/api/events/${event.id}/ticket-types`, { name: sec.name, price, quantity: qty, color: sec.color });
        } catch (e) { /* tier may already exist */ }
      }
      await api.post(`/api/events/${event.id}/generate-seatmap`, { type: 'seat', grid });
      alert(`Đã tạo ${grid.length} ghế từ ${quickSections.length} khu vực!`);
      onSuccess();
    } catch (err) { alert(err.response?.data?.msg || 'Có lỗi xảy ra'); } finally { setLoading(false); }
  };

  const addQuickSection = () => {
    const idx = quickSections.length;
    setQuickSections(prev => [...prev, {
      name: `KHU ${String.fromCharCode(65 + idx)}`,
      rows: 3, seatsPerRow: 24,
      price: '', color: DEFAULT_TIER_COLORS[idx % DEFAULT_TIER_COLORS.length]
    }]);
  };
  const updateQuickSection = (i, field, val) => setQuickSections(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n; });
  const removeQuickSection = (i) => setQuickSections(prev => prev.filter((_, idx) => idx !== i));

  // ── Submit zone mode ─────────────────────────────────────────
  const handleSubmitZone = async () => {
    setLoading(true);
    try {
      await api.post(`/api/events/${event.id}/generate-seatmap`, {
        type: 'zone',
        svg_layout: svgContainerRef.current?.innerHTML || null,
        zones: zones.map(z => ({ name: z.name, color: z.color, price: parseFloat(String(z.price).replace(/\D/g, '')), capacity: parseInt(z.capacity), svg_id: z.svg_id })),
      });
      alert('Sơ đồ đã xuất bản!'); onSuccess();
    } catch (err) { alert(err.response?.data?.msg || 'Có lỗi xảy ra'); } finally { setLoading(false); }
  };

  // ── Submit mixed mode ────────────────────────────────────────
  const handleSubmitMixed = async () => {
    setLoading(true);
    try {
      const payload = {
        type: 'mixed',
        svg_layout: svgContainerRef.current?.innerHTML || null,
        zones: zones.map(z => ({
          name: z.name, color: z.color, svg_id: z.svg_id, zone_type: z.zone_type || 'standing',
          price: parseFloat(String(z.price).replace(/\D/g, '')),
          // Standing: capacity; Seated/BestAvailable: rows + cols (or total_seats for irregular zones)
          capacity: z.zone_type === 'standing' || !z.zone_type ? parseInt(z.capacity || 0) : 0,
          rows: (z.zone_type === 'seated' || z.zone_type === 'best_available') ? parseInt(z.rows || 0) : 0,
          cols: (z.zone_type === 'seated' || z.zone_type === 'best_available') ? parseInt(z.cols || 0) : 0,
          total_seats: z.total_seats ? parseInt(z.total_seats) : undefined,
        })),
      };
      await api.post(`/api/events/${event.id}/generate-seatmap`, payload);
      const stand = zones.filter(z => z.zone_type === 'standing' || !z.zone_type).length;
      const seated = zones.filter(z => z.zone_type === 'seated').length;
      const ba = zones.filter(z => z.zone_type === 'best_available').length;
      alert(`Đã xuất bản: ${stand} khu đứng + ${seated} khu chọn ghế + ${ba} khu Best Available!`);
      onSuccess();
    } catch (err) { alert(err.response?.data?.msg || 'Có lỗi xảy ra'); } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER: MODE SELECTION
  // ─────────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
        <div style={{ background: '#111', borderRadius: '20px', padding: '40px', maxWidth: '780px', width: '94%', border: '1px solid #222', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#2CC275', fontSize: '20px' }}>Tạo Sơ đồ Chỗ ngồi</h2>
              <p style={{ color: '#555', fontSize: '13px', margin: '6px 0 0' }}>{event.title}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '22px', cursor: 'pointer' }}><FaTimes /></button>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            {[
              { key: 'zone', icon: <FaUsers style={{ fontSize: '26px' }} />, title: 'Khu vực đứng', sub: 'Zone SVG', desc: 'Concert, Lễ hội. Upload SVG tổng thể, click gán zone đứng.' },
              { key: 'seat', icon: <MdGridOn style={{ fontSize: '28px' }} />, title: 'Ghế ngồi có số', sub: 'Paint Grid', desc: 'Rạp phim, Nhà hát. Tô màu trên lưới ghế, tạo lối đi bằng tẩy.' },
              { key: 'mixed', icon: <span style={{ fontSize: '22px' }}><MdGridOn style={{ fontSize: "22px" }} /></span>, title: 'Kết hợp', sub: 'Unified SVG', desc: 'Concert lớn. Một SVG tổng, click từng khu để gán "Đứng" hoặc "Ngồi Best Available".' },
            ].map(({ key, icon, title, sub, desc }) => (
              <div key={key}
                onClick={() => { setMode(key); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2CC275'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(0)'; }}
                style={{ flex: 1, padding: '24px 16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'center', border: '2px solid #2a2a2a', background: '#0d0d0d', transition: 'all 0.2s' }}
              >
                <div style={{ marginBottom: '10px', minHeight: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#2CC275' }}>{icon}</div>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px', color: '#ddd' }}>{title}</div>
                <div style={{ fontSize: '10px', color: '#2CC275', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{sub}</div>
                <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#555' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: ZONE-ONLY BUILDER (SVG)
  // ─────────────────────────────────────────────────────────────
  if (mode === 'zone') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <ModalHeader event={event} label="KHU VỰC ĐỨNG" onBack={() => setMode(null)} onClose={onClose} />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808', overflow: 'auto', position: 'relative' }}>
            {!svgContent ? <UploadSvgPlaceholder onUpload={handleFileUpload} /> : (
              <>
                <div ref={svgContainerRef} onClick={handleSvgClickZone} dangerouslySetInnerHTML={{ __html: svgContent }}
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair' }} />
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.8)', padding: '8px 14px', borderRadius: '8px', border: '1px solid #2a2a2a', fontSize: '12px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaMousePointer style={{ color: '#2CC275' }} /> Click vào khu vực để gắn Zone
                </div>
              </>
            )}
          </div>
          <div style={{ width: '300px', background: '#111', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {editZone && (
                <div style={{ background: '#161616', padding: '16px', borderRadius: '10px', border: '1px solid #2CC275', marginBottom: '16px' }}>
                  <div style={{ color: '#2CC275', fontWeight: '700', fontSize: '13px', marginBottom: '12px' }}>Khu Đứng</div>
                  {/* Ticket reference for quick fill */}
                  <TicketReferencePanel
                    tickets={eventTickets}
                    loading={eventTicketsLoading}
                    compact
                    onApply={(ticket) => {
                      setEditZone(prev => ({ ...prev, name: ticket.name, price: String(ticket.price), color: ticket.color, linkedTicketId: ticket.id }));
                    }}
                    targetLabel="zone"
                  />
                  {/* Linked ticket badge */}
                  {editZone.linkedTicketId && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a2e20', border: '1px solid #2CC27540', borderRadius: '6px', padding: '6px 10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaLink style={{ color: '#2CC275', fontSize: '10px' }} />
                        <span style={{ color: '#2CC275', fontSize: '11px', fontWeight: '600' }}>Đã liên kết với vé "{editZone.name}"</span>
                      </div>
                      <button onClick={() => setEditZone(prev => ({ ...prev, linkedTicketId: null }))}
                        style={{ background: 'none', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px' }}
                        title="Bỏ liên kết để tự nhập">
                        <FaUnlink style={{ fontSize: '9px' }} /> Bỏ liên kết
                      </button>
                    </div>
                  )}
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inp, width: '100%', marginBottom: '8px', ...(editZone.linkedTicketId ? { opacity: 0.7, cursor: 'not-allowed', borderColor: '#2CC27530' } : {}) }}
                      value={editZone.name} readOnly={!!editZone.linkedTicketId}
                      onChange={e => { if (!editZone.linkedTicketId) setEditZone({ ...editZone, name: e.target.value }); }}
                      placeholder="Tên zone (GA, VIP...)" />
                    {editZone.linkedTicketId && <FaLock style={{ position: 'absolute', right: '12px', top: '12px', color: '#2CC27560', fontSize: '11px' }} />}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inp, width: '100%', marginBottom: '8px', ...(editZone.linkedTicketId ? { opacity: 0.7, cursor: 'not-allowed', borderColor: '#2CC27530' } : {}) }}
                      value={editZone.price ? new Intl.NumberFormat('vi-VN').format(editZone.price) : ''} readOnly={!!editZone.linkedTicketId}
                      onChange={e => { if (!editZone.linkedTicketId) setEditZone({ ...editZone, price: e.target.value.replace(/\D/g, '') }); }}
                      placeholder="Giá vé (VNĐ)" />
                    {editZone.linkedTicketId && <FaLock style={{ position: 'absolute', right: '12px', top: '12px', color: '#2CC27560', fontSize: '11px' }} />}
                  </div>
                  {(() => {
                    const linkedTicket = editZone.linkedTicketId ? eventTickets.find(t => t.id === editZone.linkedTicketId) : null;
                    const maxCapacity = linkedTicket ? linkedTicket.quantity : null;
                    const capacityVal = parseInt(editZone.capacity) || 0;
                    const exceeds = maxCapacity !== null && capacityVal > maxCapacity;
                    return (
                      <div>
                        <div style={{ position: 'relative' }}>
                          <input style={{ ...inp, width: '100%', marginBottom: exceeds ? '4px' : '8px', borderColor: exceeds ? '#ff4d4f' : undefined }}
                            type="number" min="1" max={maxCapacity || undefined}
                            value={editZone.capacity}
                            onChange={e => {
                              const val = parseInt(e.target.value) || '';
                              setEditZone({ ...editZone, capacity: val });
                            }}
                            placeholder={maxCapacity ? `Sức chứa (tối đa ${maxCapacity})` : 'Sức chứa'} />
                          {maxCapacity && <span style={{ position: 'absolute', right: '12px', top: '11px', color: '#555', fontSize: '10px' }}>/{maxCapacity}</span>}
                        </div>
                        {exceeds && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ff4d4f15', border: '1px solid #ff4d4f30', borderRadius: '6px', padding: '5px 8px', marginBottom: '8px', fontSize: '11px', color: '#ff4d4f' }}>
                            <FaExclamationTriangle style={{ fontSize: '10px', flexShrink: 0 }} />
                            Vượt quá số lượng vé đã khai báo ({maxCapacity})
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <input type="color" style={{ width: '100%', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: '12px' }} value={editZone.color} onChange={e => setEditZone({ ...editZone, color: e.target.value })} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleSaveZone} style={{ flex: 1, background: '#2CC275', border: 'none', color: '#000', padding: '9px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Lưu Zone</button>
                    <button onClick={() => { setEditZone(null); setSelectedElementId(null); }} style={{ flex: 1, background: '#222', border: 'none', color: '#aaa', padding: '9px', borderRadius: '8px', cursor: 'pointer' }}>Hủy</button>
                  </div>
                </div>
              )}
              <ZoneList zones={zones} onDelete={handleDeleteZone} onEdit={(z) => { setEditZone({ ...z }); setSelectedElementId(z.svg_id); }} />
            </div>
            <ModalFooter loading={loading} canSubmit={zones.length > 0} onSubmit={handleSubmitZone} onClose={onClose} label={`Xuất bản ${zones.length} zone`} />
          </div>
        </div>
        <style>{`svg path:hover,svg rect:hover,svg circle:hover,svg polygon:hover{fill-opacity:0.7;cursor:pointer}`}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: MIXED BUILDER — Unified SVG
  // ─────────────────────────────────────────────────────────────
  if (mode === 'mixed') {
    const standingCount = zones.filter(z => z.zone_type === 'standing' || (!z.zone_type)).length;
    const seatedCount = zones.filter(z => z.zone_type === 'seated').length;
    const baCount = zones.filter(z => z.zone_type === 'best_available').length;

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <ModalHeader event={event} label="KẾT HỢP — UNIFIED SVG" onBack={() => setMode(null)} onClose={onClose} />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* SVG Canvas */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808', overflow: 'auto', position: 'relative' }}>
            {!svgContent ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <UploadSvgPlaceholder onUpload={handleFileUpload} desc="Upload 1 file SVG tổng chứa tất cả khu vực (đứng + ngồi)" />
                <div style={{ marginTop: '20px', background: '#111', borderRadius: '12px', padding: '16px', border: '1px solid #1a1a1a', maxWidth: '420px', margin: '20px auto 0', textAlign: 'left' }}>
                  <div style={{ color: '#888', fontSize: '12px', lineHeight: '1.8' }}>
                    <div style={{ color: '#2CC275', fontWeight: '700', marginBottom: '8px' }}>Hướng dẫn thiết kế SVG</div>
                    <div>1. Vẽ <strong style={{ color: '#eee' }}>tất cả khu vực</strong> trên 1 file SVG (khu đứng + khán đài ngồi)</div>
                    <div>2. Upload SVG → Click từng khu trên sơ đồ</div>
                    <div>3. Chọn loại: <strong style={{ color: '#2CC275' }}>Đứng</strong> (nhập sức chứa) hoặc <strong style={{ color: '#1890ff' }}>Ngồi</strong> (nhập rows × cols)</div>
                    <div>4. Xuất bản — hệ thống tự tạo ghế trong DB</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div ref={svgContainerRef} onClick={handleSvgClickMixed} dangerouslySetInnerHTML={{ __html: svgContent }}
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair' }} />
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.85)', padding: '10px 14px', borderRadius: '10px', border: '1px solid #2a2a2a', fontSize: '12px', color: '#aaa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FaMousePointer style={{ color: '#2CC275' }} /> Click khu vực để gắn loại</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#2CC275' }}><FaUsers style={{ marginRight: "4px" }} /> {standingCount} đứng</span>
                    <span style={{ color: '#1890ff' }}><FaChair style={{ marginRight: "4px" }} /> {seatedCount} ngồi</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Sidebar */}
          <div style={{ width: '320px', background: '#111', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

              {/* Mixed Zone Edit Popup */}
              {editMixedZone && (
                <div style={{ background: '#161616', padding: '16px', borderRadius: '12px', border: '1px solid #2CC275', marginBottom: '16px' }}>
                  <div style={{ color: '#2CC275', fontWeight: '700', fontSize: '13px', marginBottom: '14px' }}>
                    Cấu hình khu vực
                  </div>


                  {/* Zone type toggle — 3 options */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                    {[
                      { key: 'standing', label: 'Khu Đứng', color: '#2CC275', icon: <FaUsers style={{marginRight:'4px'}}/> },
                      { key: 'seated', label: 'Chọn Ghế', color: '#1890ff', icon: <FaChair style={{marginRight:'4px'}}/> },
                      { key: 'best_available', label: 'Best Available', color: '#FFC107', icon: <FaMagic style={{marginRight:'4px'}}/> },
                    ].map(opt => {
                      const isActive = editMixedZone.zone_type === opt.key;
                      return (
                        <button key={opt.key}
                          onClick={() => setEditMixedZone({ ...editMixedZone, zone_type: opt.key })}
                          style={{ flex: 1, padding: '10px 6px', borderRadius: '8px', border: `2px solid ${isActive ? opt.color : '#2a2a2a'}`, background: isActive ? `${opt.color}20` : 'transparent', color: isActive ? opt.color : '#666', cursor: 'pointer', fontWeight: '700', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {opt.icon}{opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Ticket reference for quick fill */}
                  <TicketReferencePanel
                    tickets={eventTickets}
                    loading={eventTicketsLoading}
                    compact
                    onApply={(ticket) => {
                      setEditMixedZone(prev => ({ ...prev, name: ticket.name, price: String(ticket.price), color: ticket.color, linkedTicketId: ticket.id }));
                    }}
                    targetLabel="khu vực"
                  />
                  {/* Linked ticket badge */}
                  {editMixedZone.linkedTicketId && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a2e20', border: '1px solid #2CC27540', borderRadius: '6px', padding: '6px 10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaLink style={{ color: '#2CC275', fontSize: '10px' }} />
                        <span style={{ color: '#2CC275', fontSize: '11px', fontWeight: '600' }}>Liên kết: "{editMixedZone.name}"</span>
                      </div>
                      <button onClick={() => setEditMixedZone(prev => ({ ...prev, linkedTicketId: null }))}
                        style={{ background: 'none', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px' }}
                        title="Bỏ liên kết để tự nhập">
                        <FaUnlink style={{ fontSize: '9px' }} /> Bỏ liên kết
                      </button>
                    </div>
                  )}
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inp, width: '100%', marginBottom: '8px', boxSizing: 'border-box', ...(editMixedZone.linkedTicketId ? { opacity: 0.7, cursor: 'not-allowed', borderColor: '#2CC27530' } : {}) }}
                      value={editMixedZone.name} readOnly={!!editMixedZone.linkedTicketId}
                      onChange={e => { if (!editMixedZone.linkedTicketId) setEditMixedZone({ ...editMixedZone, name: e.target.value }); }}
                      placeholder={editMixedZone.zone_type === 'standing' ? 'Tên khu (GA 1A, Fanzone...)' : editMixedZone.zone_type === 'best_available' ? 'Tên khu (CAT B, Khán đài C...)' : 'Tên khu (VIP A, CAT 1A...)'} />
                    {editMixedZone.linkedTicketId && <FaLock style={{ position: 'absolute', right: '12px', top: '12px', color: '#2CC27560', fontSize: '11px' }} />}
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inp, width: '100%', marginBottom: '8px', boxSizing: 'border-box', ...(editMixedZone.linkedTicketId ? { opacity: 0.7, cursor: 'not-allowed', borderColor: '#2CC27530' } : {}) }}
                      value={editMixedZone.price ? new Intl.NumberFormat('vi-VN').format(editMixedZone.price) : ''} readOnly={!!editMixedZone.linkedTicketId}
                      onChange={e => { if (!editMixedZone.linkedTicketId) setEditMixedZone({ ...editMixedZone, price: e.target.value.replace(/\D/g, '') }); }}
                      placeholder="Giá vé (VNĐ)" />
                    {editMixedZone.linkedTicketId && <FaLock style={{ position: 'absolute', right: '12px', top: '12px', color: '#2CC27560', fontSize: '11px' }} />}
                  </div>

                  {(() => {
                    const linkedTicket = editMixedZone.linkedTicketId ? eventTickets.find(t => t.id === editMixedZone.linkedTicketId) : null;
                    const maxQty = linkedTicket ? linkedTicket.quantity : null;
                    const isStanding = editMixedZone.zone_type === 'standing';
                    const useTotalMode = editMixedZone.seat_input_mode === 'total';
                    const currentQty = isStanding
                      ? (parseInt(editMixedZone.capacity) || 0)
                      : useTotalMode
                        ? (parseInt(editMixedZone.total_seats) || 0)
                        : ((editMixedZone.rows || 0) * (editMixedZone.cols || 0));
                    const exceeds = maxQty !== null && currentQty > maxQty;

                    return isStanding ? (
                      <div>
                        <div style={{ position: 'relative' }}>
                          <input style={{ ...inp, width: '100%', marginBottom: exceeds ? '4px' : '8px', boxSizing: 'border-box', borderColor: exceeds ? '#ff4d4f' : undefined }}
                            type="number" min="1" max={maxQty || undefined}
                            value={editMixedZone.capacity}
                            onChange={e => setEditMixedZone({ ...editMixedZone, capacity: e.target.value })}
                            placeholder={maxQty ? `Sức chứa (tối đa ${maxQty})` : 'Sức chứa (người)'} />
                          {maxQty && <span style={{ position: 'absolute', right: '12px', top: '11px', color: '#555', fontSize: '10px' }}>/{maxQty}</span>}
                        </div>
                        {exceeds && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ff4d4f15', border: '1px solid #ff4d4f30', borderRadius: '6px', padding: '5px 8px', marginBottom: '8px', fontSize: '11px', color: '#ff4d4f' }}>
                            <FaExclamationTriangle style={{ fontSize: '10px', flexShrink: 0 }} />
                            Vượt quá số lượng vé đã khai báo ({maxQty})
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginBottom: '8px' }}>
                        {/* Toggle: Tổng số ghế vs Hàng × Cột */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {[
                            { key: 'total', label: 'Tổng số ghế', desc: 'Nhập số lượng, hệ thống tự bố trí' },
                            { key: 'grid', label: 'Hàng × Cột', desc: 'Chỉ định chính xác' },
                          ].map(opt => {
                            const active = useTotalMode ? opt.key === 'total' : opt.key === 'grid';
                            return (
                              <button key={opt.key}
                                onClick={() => setEditMixedZone({ ...editMixedZone, seat_input_mode: opt.key === 'total' ? 'total' : 'grid' })}
                                title={opt.desc}
                                style={{ flex: 1, padding: '6px 4px', borderRadius: '6px', border: `1.5px solid ${active ? '#1890ff' : '#2a2a2a'}`, background: active ? '#1890ff18' : 'transparent', color: active ? '#1890ff' : '#555', cursor: 'pointer', fontWeight: '600', fontSize: '11px' }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        {useTotalMode ? (
                          /* Tổng số ghế mode */
                          <div>
                            <div style={{ position: 'relative' }}>
                              <input style={{ ...inp, width: '100%', marginBottom: '4px', boxSizing: 'border-box', textAlign: 'center', fontWeight: '700', fontSize: '16px', borderColor: exceeds ? '#ff4d4f' : undefined }}
                                type="number" min="1" max={maxQty || 9999}
                                value={editMixedZone.total_seats || ''}
                                onChange={e => setEditMixedZone({ ...editMixedZone, total_seats: parseInt(e.target.value) || '' })}
                                placeholder={maxQty ? `Số ghế (tối đa ${maxQty})` : 'Nhập tổng số ghế'} />
                              {maxQty && <span style={{ position: 'absolute', right: '12px', top: '13px', color: '#555', fontSize: '10px' }}>/{maxQty}</span>}
                            </div>
                            <div style={{ color: '#555', fontSize: '10px', lineHeight: '1.5', marginBottom: '4px', padding: '0 2px' }}>
                              Phù hợp với zone không phải hình chữ nhật. Hệ thống tự chia đều ghế vào các hàng.
                            </div>
                          </div>
                        ) : (
                          /* Hàng × Cột mode */
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ display: 'block', color: '#666', fontSize: '11px', marginBottom: '4px' }}>Số hàng</label>
                              <input style={{ ...inp, width: '100%', textAlign: 'center', fontWeight: '700', boxSizing: 'border-box' }}
                                type="number" min="1" max="26" value={editMixedZone.rows}
                                onChange={e => setEditMixedZone({ ...editMixedZone, rows: parseInt(e.target.value) || 1 })} />
                            </div>
                            <div>
                              <label style={{ display: 'block', color: '#666', fontSize: '11px', marginBottom: '4px' }}>Số cột</label>
                              <input style={{ ...inp, width: '100%', textAlign: 'center', fontWeight: '700', boxSizing: 'border-box' }}
                                type="number" min="1" max="60" value={editMixedZone.cols}
                                onChange={e => setEditMixedZone({ ...editMixedZone, cols: parseInt(e.target.value) || 1 })} />
                            </div>
                          </div>
                        )}

                        {/* Status bar */}
                        <div style={{ color: exceeds ? '#ff4d4f' : (editMixedZone.zone_type === 'best_available' ? '#FFC107' : '#1890ff'), fontSize: '11px', textAlign: 'center', background: exceeds ? '#ff4d4f10' : (editMixedZone.zone_type === 'best_available' ? '#FFC10710' : '#1890ff10'), padding: '6px', borderRadius: '6px', border: exceeds ? '1px solid #ff4d4f30' : 'none', marginTop: '4px' }}>
                          {exceeds ? (
                            <><FaExclamationTriangle style={{ marginRight: '4px' }} /> {currentQty} ghế vượt giới hạn {maxQty} vé đã khai báo</>
                          ) : editMixedZone.zone_type === 'best_available' ? (
                            <><FaMagic style={{ marginRight: "4px" }} /> {currentQty} ghế{maxQty ? ` / ${maxQty} vé` : ''} — Backend tự gán chỗ tốt nhất</>
                          ) : (
                            <><FaChair style={{ marginRight: "4px" }} /> Tự tạo {currentQty} ghế{maxQty ? ` / ${maxQty} vé` : ''} trong DB</>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <label style={{ color: '#666', fontSize: '12px' }}>Màu:</label>
                    <input type="color" style={{ width: '40px', height: '30px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      value={editMixedZone.color} onChange={e => setEditMixedZone({ ...editMixedZone, color: e.target.value })} />
                    <div style={{ width: '60px', height: '20px', borderRadius: '4px', background: editMixedZone.color }} />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleSaveMixedZone} style={{ flex: 1, background: '#2CC275', border: 'none', color: '#000', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                      Lưu khu vực
                    </button>
                    <button onClick={() => { setEditMixedZone(null); setSelectedElementId(null); }} style={{ flex: 1, background: '#222', border: 'none', color: '#aaa', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Zone list */}
              <div style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                Khu vực ({zones.length})
              </div>
              {zones.length === 0 && <p style={{ color: '#444', fontSize: '13px' }}>Upload SVG rồi click từng khu vực</p>}
              {zones.map((z, i) => {
                const isSeatedOrBA = z.zone_type === 'seated' || z.zone_type === 'best_available';
                const seatCount = isSeatedOrBA
                  ? (z.total_seats ? parseInt(z.total_seats) : (z.rows || 0) * (z.cols || 0))
                  : 0;
                return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161616', padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', borderLeft: `3px solid ${z.color}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#eee', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {z.zone_type === 'best_available' ? <FaMagic style={{color:'#FFC107'}}/> : z.zone_type === 'seated' ? <FaChair /> : <FaUsers />} {z.name}
                    </div>
                    <div style={{ color: '#555', fontSize: '11px' }}>
                      {isSeatedOrBA
                        ? `${seatCount} ghế · ${new Intl.NumberFormat('vi-VN').format(z.price)}đ${z.zone_type === 'best_available' ? ' · BA' : ''}`
                        : `${z.capacity} chỗ · ${new Intl.NumberFormat('vi-VN').format(z.price)}đ`
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => {
                      setEditMixedZone({ ...z, seat_input_mode: z.total_seats ? 'total' : 'grid' });
                      setSelectedElementId(z.svg_id);
                    }} style={{ background: 'none', border: 'none', color: '#1890ff', cursor: 'pointer', padding: '4px', fontSize: '12px' }} title="Sửa"><FaEdit /></button>
                    <button onClick={() => handleDeleteZone(z.svg_id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '4px' }} title="Xóa"><FaTimes /></button>
                  </div>
                </div>
                );
              })}

              {zones.length > 0 && (
                <div style={{ background: '#141414', borderRadius: '10px', padding: '12px', border: '1px solid #1a1a1a', marginTop: '16px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>Khu Đứng</span><strong style={{ color: '#2CC275' }}>{standingCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>Khu Chọn Ghế</span><strong style={{ color: '#1890ff' }}>{seatedCount}</strong>
                  </div>
                  {baCount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#888' }}>Best Available</span><strong style={{ color: '#FFC107' }}>{baCount}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>Tổng ghế</span>
                    <strong style={{ color: '#eee' }}>{zones.filter(z => z.zone_type === 'seated' || z.zone_type === 'best_available').reduce((sum, z) => sum + (z.total_seats ? parseInt(z.total_seats) : (z.rows || 0) * (z.cols || 0)), 0)}</strong>
                  </div>
                </div>
              )}
            </div>

            <ModalFooter loading={loading} canSubmit={zones.length > 0} onSubmit={handleSubmitMixed} onClose={onClose}
              label={<>Xuất bản ({standingCount} <FaUsers style={{ margin: "0 2px" }} /> + {seatedCount} <FaChair style={{ margin: "0 2px" }} />)</>} />
          </div>
        </div>
        <style>{`svg path:hover,svg rect:hover,svg circle:hover,svg polygon:hover,svg g:hover>path,svg g:hover>rect{fill-opacity:0.8;cursor:pointer;transition:fill-opacity 0.15s}`}</style>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────
  // RENDER: SEAT BUILDER — Grid Setup
  // ─────────────────────────────────────────────────────────────
  if (!gridReady) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
        <div style={{ background: '#111', borderRadius: '20px', padding: '40px', maxWidth: '480px', width: '94%', border: '1px solid #222', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#2CC275', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MdGridOn /> Bước 1: Khởi tạo Lưới Không Gian
              </h3>
              <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0' }}>{event.title}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '22px', cursor: 'pointer' }}><FaTimes /></button>
          </div>
          {/* Mode toggle — 3 tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {[
              { key: 'standard', label: 'Lưới chuẩn', color: '#2CC275', active: !customRowMode && !quickCreateMode },
              { key: 'custom', label: 'Hàng tùy chỉnh', color: '#1890ff', active: customRowMode && !quickCreateMode },
              { key: 'quick', label: 'Tạo nhanh', color: '#FFC107', active: quickCreateMode },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setQuickCreateMode(tab.key === 'quick'); setCustomRowMode(tab.key === 'custom'); }}
                style={{ flex: 1, padding: '10px 6px', borderRadius: '8px', border: `2px solid ${tab.active ? tab.color : '#2a2a2a'}`, background: tab.active ? `${tab.color}20` : 'transparent', color: tab.active ? tab.color : '#555', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #1a1a1a' }}>
            {quickCreateMode ? (
              /* ═══ QUICK CREATE UI ═══ */
              <div>
                <p style={{ color: '#FFC107', fontSize: '13px', marginBottom: '16px', lineHeight: '1.6' }}>
                  <strong style={{ color: '#eee' }}>Nhập các khu vực</strong> (KHU A, KHU B...) với số hàng và ghế/hàng. Hệ thống <strong style={{ color: '#FFC107' }}>tự sinh toàn bộ ghế + hạng vé</strong>, không cần tô vẽ.
                </p>
                {/* Ticket Reference Panel */}
                <TicketReferencePanel
                  tickets={eventTickets}
                  loading={eventTicketsLoading}
                  onApply={(ticket) => {
                    setQuickSections(prev => [...prev, {
                      name: ticket.name, rows: 2, seatsPerRow: 24,
                      price: String(ticket.price), color: ticket.color,
                      linkedTicketId: ticket.id,
                    }]);
                  }}
                  targetLabel="khu vực"
                  showAddNew={quickSections.length < 8}
                />
                {/* Section list */}
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {quickSections.map((sec, i) => {
                    const isLinked = !!sec.linkedTicketId;
                    const linkedTicket = isLinked ? eventTickets.find(t => t.id === sec.linkedTicketId) : null;
                    const maxQty = linkedTicket ? linkedTicket.quantity : null;
                    const totalSeats = sec.rows * sec.seatsPerRow;
                    const exceeds = maxQty !== null && totalSeats > maxQty;
                    return (
                    <div key={i} style={{ background: '#141414', borderRadius: '10px', padding: '14px', marginBottom: '10px', borderLeft: `4px solid ${sec.color}` }}>
                      {/* Linked badge */}
                      {isLinked && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FaLink style={{ color: '#2CC275', fontSize: '9px' }} />
                            <span style={{ color: '#2CC275', fontSize: '10px', fontWeight: '600' }}>Liên kết vé "{sec.name}"</span>
                          </div>
                          <button onClick={() => updateQuickSection(i, 'linkedTicketId', null)}
                            style={{ background: 'none', border: 'none', color: '#666', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: '2px' }}>
                            <FaUnlink style={{ fontSize: '8px' }} /> Bỏ
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                          <input style={{ ...inp, fontWeight: '700', fontSize: '15px', width: '100%', ...(isLinked ? { opacity: 0.7, cursor: 'not-allowed', borderColor: '#2CC27530' } : {}) }}
                            value={sec.name} readOnly={isLinked}
                            onChange={e => { if (!isLinked) updateQuickSection(i, 'name', e.target.value); }}
                            placeholder="Tên khu (KHU A...)" />
                          {isLinked && <FaLock style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#2CC27560', fontSize: '10px' }} />}
                        </div>
                        <button onClick={() => removeQuickSection(i)} disabled={quickSections.length <= 1}
                          style={{ width: 36, height: 36, background: '#ff4d4f20', border: '1px solid #ff4d4f40', borderRadius: '8px', color: '#ff4d4f', cursor: quickSections.length > 1 ? 'pointer' : 'not-allowed', fontSize: 16 }}>×</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '3px' }}>Số hàng</label>
                          <input type="number" min="1" max="26" style={{ ...inp, width: '100%', textAlign: 'center', fontWeight: '700', boxSizing: 'border-box' }}
                            value={sec.rows}
                            onChange={e => updateQuickSection(i, 'rows', Math.max(1, Math.min(26, parseInt(e.target.value) || 1)))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '3px' }}>Ghế/hàng</label>
                          <input type="number" min="1" max="60" style={{ ...inp, width: '100%', textAlign: 'center', fontWeight: '700', boxSizing: 'border-box' }}
                            value={sec.seatsPerRow}
                            onChange={e => updateQuickSection(i, 'seatsPerRow', Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))} />
                        </div>
                        <div style={{ position: 'relative' }}>
                          <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '3px' }}>Giá vé (VNĐ)</label>
                          <input style={{ ...inp, width: '100%', textAlign: 'center', fontWeight: '700', boxSizing: 'border-box', ...(isLinked ? { opacity: 0.7, cursor: 'not-allowed', borderColor: '#2CC27530' } : {}) }}
                            value={sec.price ? new Intl.NumberFormat('vi-VN').format(sec.price) : ''} readOnly={isLinked}
                            onChange={e => { if (!isLinked) updateQuickSection(i, 'price', e.target.value.replace(/\D/g, '')); }}
                            placeholder="VNĐ" />
                          {isLinked && <FaLock style={{ position: 'absolute', right: '8px', bottom: '12px', color: '#2CC27560', fontSize: '9px' }} />}
                        </div>
                      </div>
                      {exceeds && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ff4d4f15', border: '1px solid #ff4d4f30', borderRadius: '6px', padding: '5px 8px', marginBottom: '8px', fontSize: '11px', color: '#ff4d4f' }}>
                          <FaExclamationTriangle style={{ fontSize: '10px', flexShrink: 0 }} />
                          {totalSeats} ghế vượt giới hạn {maxQty} vé đã khai báo
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ color: '#666', fontSize: '11px' }}>Màu:</label>
                        <input type="color" style={{ width: 32, height: 24, border: 'none', background: 'transparent', cursor: 'pointer' }}
                          value={sec.color}
                          onChange={e => updateQuickSection(i, 'color', e.target.value)} />
                        <div style={{ flex: 1, textAlign: 'right', fontSize: '11px', fontWeight: '700', color: exceeds ? '#ff4d4f' : sec.color }}>
                          {totalSeats} ghế{maxQty ? ` / ${maxQty} vé` : ''}
                        </div>
                      </div>
                    </div>
                  );})}                </div>
                <button onClick={addQuickSection} disabled={quickSections.length >= 8}
                  style={{ width: '100%', marginTop: '8px', padding: '10px', background: '#FFC10710', border: '1px dashed #FFC10750', borderRadius: '8px', color: '#FFC107', cursor: quickSections.length < 8 ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '13px' }}>
                  + Thêm khu vực ({quickSections.length}/8)
                </button>
                {/* Stats */}
                <div style={{ marginTop: '12px', background: '#080808', borderRadius: '8px', padding: '10px', fontSize: '11px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#555' }}>Tổng khu: <strong style={{ color: '#FFC107' }}>{quickSections.length}</strong></span>
                  <span style={{ color: '#555' }}>Tổng hàng: <strong style={{ color: '#2CC275' }}>{quickSections.reduce((sum, s) => sum + s.rows, 0)}</strong></span>
                  <span style={{ color: '#555' }}>Tổng ghế: <strong style={{ color: '#eee' }}>{quickSections.reduce((sum, s) => sum + s.rows * s.seatsPerRow, 0)}</strong></span>
                </div>
              </div>
            ) : !customRowMode ? (
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
                Nhập <strong style={{ color: '#eee' }}>kích thước tối đa</strong> của hội trường — hệ thống tạo 1 lưới ghế tổng thể.<br />
                <span style={{ color: '#555' }}>Tô màu từng khu theo hạng vé, dùng tẩy để tạo lối đi.</span>
              </p>
            ) : (
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
                Định nghĩa <strong style={{ color: '#eee' }}>từng hàng ghế</strong> với số lượng và vị trí bắt đầu riêng.<br />
                <span style={{ color: '#1890ff' }}>Phù hợp cho hội trường hình cung, chữ L, bậc thang...</span>
              </p>
            )}
            {!quickCreateMode && (customRowMode ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: '6px', marginBottom: '6px', padding: '0 4px' }}>
                  <span style={{ color: '#555', fontSize: '11px', textAlign: 'center' }}>Hàng</span>
                  <span style={{ color: '#555', fontSize: '11px' }}>Số ghế</span>
                  <span style={{ color: '#555', fontSize: '11px' }}>Ghế bắt đầu</span>
                  <span></span>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {customRows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <div style={{ background: '#1a1a1a', borderRadius: '6px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2CC275', fontWeight: '800', fontSize: '14px' }}>{row.label}</div>
                      <input type="number" min="1" max="60" value={row.seats}
                        onChange={e => updateCustomRow(i, 'seats', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...inp, textAlign: 'center', fontWeight: '700' }} placeholder="Số ghế" />
                      <input type="number" min="1" max="60" value={row.startSeat}
                        onChange={e => updateCustomRow(i, 'startSeat', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...inp, textAlign: 'center', fontWeight: '700' }} placeholder="Bắt đầu từ" />
                      <button onClick={() => removeCustomRow(i)} style={{ width: '36px', height: '36px', background: '#ff4d4f20', border: '1px solid #ff4d4f40', borderRadius: '6px', color: '#ff4d4f', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
                <button onClick={addCustomRow} disabled={customRows.length >= 26}
                  style={{ width: '100%', marginTop: '10px', padding: '9px', background: '#1890ff15', border: '1px dashed #1890ff50', borderRadius: '8px', color: '#1890ff', cursor: customRows.length < 26 ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '13px' }}>
                  + Thêm hàng {customRows.length > 0 && `(${customRows.length}/26)`}
                </button>
                {customRows.length > 0 && (
                  <div style={{ marginTop: '12px', background: '#080808', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#555', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span>Tổng hàng: <strong style={{ color: '#2CC275' }}>{customRows.length}</strong></span>
                    <span>Tổng ghế: <strong style={{ color: '#1890ff' }}>{customRows.reduce((sum, r) => sum + r.seats, 0)}</strong></span>
                    <span>Hàng max: <strong style={{ color: '#eee' }}>{Math.max(...customRows.map(r => r.seats))} ghế</strong></span>
                  </div>
                )}
              </div>
            ) : (
            <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '6px' }}>Số hàng (tối đa {MAX_ROWS})</label>
                <input style={{ ...inp, width: '100%', fontSize: '28px', fontWeight: '800', textAlign: 'center', color: '#2CC275', boxSizing: 'border-box' }}
                  type="number" min="1" max={MAX_ROWS} value={gridRows}
                  onChange={e => setGridRows(Math.min(MAX_ROWS, Math.max(1, parseInt(e.target.value) || 1)))} />
                <div style={{ textAlign: 'center', color: '#555', fontSize: '11px', marginTop: '4px' }}>{ROW_LABELS[0]} → {ROW_LABELS[gridRows - 1]}</div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '6px' }}>Số cột (tối đa {MAX_COLS})</label>
                <input style={{ ...inp, width: '100%', fontSize: '28px', fontWeight: '800', textAlign: 'center', color: '#1890ff', boxSizing: 'border-box' }}
                  type="number" min="1" max={MAX_COLS} value={gridCols}
                  onChange={e => setGridCols(Math.min(MAX_COLS, Math.max(1, parseInt(e.target.value) || 1)))} />
                <div style={{ textAlign: 'center', color: '#555', fontSize: '11px', marginTop: '4px' }}>Ghế 1 → {gridCols}</div>
              </div>
            </div>

            <div style={{ background: '#080808', borderRadius: '10px', padding: '14px', textAlign: 'center', marginTop: '20px' }}>
              <div style={{ color: '#555', fontSize: '11px', marginBottom: '8px' }}>Tổng {gridRows * gridCols} ô · {gridRows} hàng × {gridCols} cột</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', maxHeight: '100px', overflow: 'hidden' }}>
                {Array.from({ length: Math.min(gridRows, 5) }).map((_, r) => (
                  <div key={r} style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <span style={{ width: '16px', fontSize: '9px', color: '#444' }}>{ROW_LABELS[r]}</span>
                    {Array.from({ length: Math.min(gridCols, 20) }).map((_, c) => (
                      <div key={c} style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#1e2a20', border: '1px solid #2C3C2E' }} />
                    ))}
                    {gridCols > 20 && <span style={{ fontSize: '9px', color: '#444' }}>+{gridCols - 20}</span>}
                  </div>
                ))}
                {gridRows > 5 && <div style={{ fontSize: '10px', color: '#444' }}>+{gridRows - 5} hàng nữa</div>}
              </div>
            </div>
            </>
            ))}
          </div>  {/* close outer card */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setMode(null)} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>← Đổi loại</button>
            {quickCreateMode ? (
              <button onClick={handleQuickCreate} disabled={loading}
                style={{ flex: 2, background: loading ? '#555' : '#FFC107', border: 'none', color: '#000', padding: '12px', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Đang tạo...</> : <><FaMagic /> Tạo nhanh {quickSections.reduce((sum, s) => sum + s.rows * s.seatsPerRow, 0)} ghế</>}
              </button>
            ) : (
              <button onClick={initGrid} style={{ flex: 2, background: customRowMode ? '#1890ff' : '#2CC275', border: 'none', color: customRowMode ? '#fff' : '#000', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <MdGridOn /> {customRowMode ? `Tạo sơ đồ ${customRows.length} hàng` : `Tạo lưới ${gridRows} × ${gridCols}`}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: SEAT PAINT CANVAS
  // ─────────────────────────────────────────────────────────────
  const canSubmit = Object.values(cellMap).some(v => v && v !== 'disabled');

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080808', zIndex: 1000, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      <div style={{ padding: '10px 20px', background: '#0f0f0f', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ color: '#2CC275', fontWeight: '700', fontSize: '16px' }}>Seatmap Builder</span>
          <span style={{ color: '#444', fontSize: '14px' }}>— {event.title}</span>
          <span style={{ background: customRowMode ? '#1890ff20' : '#2CC27520', color: customRowMode ? '#1890ff' : '#2CC275', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{customRowMode ? 'HÀNG TÙY CHỈNH' : 'GHẾ CÓ SỐ'}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { setGridReady(false); setCellMap({}); setHistory([]); }} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>← Đổi lưới</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', cursor: 'pointer' }}><FaTimes /></button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ background: '#ff6b3520', borderBottom: '1px solid #ff6b3540', padding: '12px 20px', color: '#ff6b35', fontSize: '13px', fontWeight: '600', animation: 'slideDown 0.3s ease-out' }}>
          {toastMessage}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Paint Canvas */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }} onContextMenu={e => e.preventDefault()}>
          <div style={{ background: 'linear-gradient(135deg, #2CC275, #1a8a4a)', padding: '10px 60px', borderRadius: '10px 10px 50% 50%', color: 'white', fontWeight: '800', fontSize: '14px', letterSpacing: '4px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(44,194,117,0.3)', whiteSpace: 'nowrap' }}>
            SÂN KHẤU
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {customRowMode ? (
              customRows.map(({ label, seats, startSeat }, r) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ width: '20px', textAlign: 'right', fontSize: '11px', color: '#1890ff', fontWeight: '700', userSelect: 'none', marginRight: '4px' }}>{label}</span>
                  {Array.from({ length: seats }).map((_, c) => {
                    const seatNum = startSeat + c;
                    const key = cellKey(label, seatNum);
                    const cell = cellMap[key];
                    const isDisabled = cell === 'disabled';
                    const isColored = cell && !isDisabled;
                    return (
                      <div key={c}
                        onMouseDown={e => { e.preventDefault(); commitHistory(); setIsPainting(true); paintCellByKey(label, seatNum); }}
                        onMouseEnter={() => { if (isPainting) paintCellByKey(label, seatNum); }}
                        title={isDisabled ? `${label}${seatNum} — Lối đi` : isColored ? `${label}${seatNum} — ${cell.tier}` : `${label}${seatNum}`}
                        style={{ width: '20px', height: '20px', borderRadius: isDisabled ? '3px' : '4px 4px 6px 6px', cursor: 'crosshair', flexShrink: 0, background: isDisabled ? 'transparent' : isColored ? cell.color : '#1e2a20', border: isDisabled ? '1px dashed #2a2a2a' : isColored ? `1px solid ${cell.color}88` : '1px solid #2a3a2a', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: '700', opacity: isDisabled ? 0.3 : 1 }}>
                        {isDisabled ? '×' : seatNum <= 9 ? seatNum : ''}
                      </div>
                    );
                  })}
                  <span style={{ width: '20px', fontSize: '11px', color: '#1890ff', fontWeight: '700', userSelect: 'none', marginLeft: '4px' }}>{label}</span>
                </div>
              ))
            ) : (
              Array.from({ length: gridRows }).map((_, r) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ width: '20px', textAlign: 'right', fontSize: '11px', color: '#444', fontWeight: '700', userSelect: 'none', marginRight: '4px' }}>{ROW_LABELS[r]}</span>
                  {Array.from({ length: gridCols }).map((_, c) => {
                    const key = cellKey(ROW_LABELS[r], c + 1);
                    const cell = cellMap[key];
                    const isDisabled = cell === 'disabled';
                    const isColored = cell && !isDisabled;
                    return (
                      <div key={c}
                        onMouseDown={e => handleCellMouseDown(r, c, e)}
                        onMouseEnter={() => handleCellMouseEnter(r, c)}
                        title={isDisabled ? `${ROW_LABELS[r]}${c + 1} — Lối đi` : isColored ? `${ROW_LABELS[r]}${c + 1} — ${cell.tier}` : `${ROW_LABELS[r]}${c + 1}`}
                        style={{ width: '20px', height: '20px', borderRadius: isDisabled ? '3px' : '4px 4px 6px 6px', cursor: 'crosshair', flexShrink: 0, background: isDisabled ? 'transparent' : isColored ? cell.color : '#1e2a1e', border: isDisabled ? '1px dashed #2a2a2a' : isColored ? `1px solid ${cell.color}88` : '1px solid #2a3a2a', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: '700', opacity: isDisabled ? 0.3 : 1 }}>
                        {isDisabled ? '×' : c < 9 ? c + 1 : ''}
                      </div>
                    );
                  })}
                  <span style={{ width: '20px', fontSize: '11px', color: '#444', fontWeight: '700', userSelect: 'none', marginLeft: '4px' }}>{ROW_LABELS[r]}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}><div style={{ width: '14px', height: '14px', background: '#1e2a1e', borderRadius: '3px', border: '1px solid #2a3a2a' }} />Chưa phân hạng</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}><div style={{ width: '14px', height: '14px', background: 'transparent', borderRadius: '3px', border: '1px dashed #555', opacity: 0.5 }} />Lối đi</div>
            {tiers.map(t => <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888' }}><div style={{ width: '14px', height: '14px', background: t.color, borderRadius: '3px' }} />{t.name}</div>)}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: '280px', background: '#0f0f0f', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Công cụ</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setTool('paint')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${tool === 'paint' ? '#2CC275' : '#1a1a1a'}`, background: tool === 'paint' ? '#2CC27520' : '#141414', color: tool === 'paint' ? '#2CC275' : '#666', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MdPalette /> Bút vẽ</button>
                <button onClick={() => setTool('eraser')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${tool === 'eraser' ? '#ff4d4f' : '#1a1a1a'}`, background: tool === 'eraser' ? '#ff4d4f20' : '#141414', color: tool === 'eraser' ? '#ff4d4f' : '#666', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FaEraser /> Tẩy</button>
                <button onClick={handleUndo} disabled={!history.length} title="Hoàn tác (Ctrl+Z)" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${history.length ? '#1890ff' : '#1a1a1a'}`, background: history.length ? '#1890ff20' : '#141414', color: history.length ? '#1890ff' : '#333', cursor: history.length ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}><FaUndo /> {history.length > 0 && <span>Hoàn tác</span>}</button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                Hạng vé {loadingTiers && <FaSpinner style={{ animation: 'spin 1s linear infinite', marginLeft: '6px' }} />}
              </div>
              {tiers.length === 0 && !loadingTiers && <div style={{ fontSize: '12px', color: '#444', padding: '12px', background: '#141414', borderRadius: '8px', textAlign: 'center' }}>Chưa có hạng vé</div>}
              {tiers.map(tier => {
                const isActive = tool === 'paint' && activeTier?.name === tier.name;
                const count = seatStats.byTier[tier.name] || 0;
                const quotaExceeded = count >= tier.quantity;
                return (
                  <div key={tier.name} onClick={() => { setActiveTier(tier); setTool('paint'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', marginBottom: '6px', cursor: 'pointer', border: `2px solid ${isActive ? tier.color : '#1a1a1a'}`, background: isActive ? `${tier.color}15` : '#141414', transition: 'all 0.15s', opacity: quotaExceeded ? 0.5 : 1 }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: tier.color, boxShadow: isActive ? `0 0 10px ${tier.color}88` : 'none', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: isActive ? '#eee' : '#888', fontWeight: '700', fontSize: '13px' }}>{tier.name}</div>
                      <div style={{ color: '#555', fontSize: '11px' }}>{new Intl.NumberFormat('vi-VN').format(tier.price)}đ</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: quotaExceeded ? '#ff4d4f' : (isActive ? tier.color : '#555'), fontWeight: '800', fontSize: '14px' }}>
                        {count}/{tier.quantity}
                      </div>
                      <div style={{ color: quotaExceeded ? '#ff4d4f' : '#444', fontSize: '10px', fontWeight: quotaExceeded ? '700' : 'normal' }}>
                        {quotaExceeded ? '!' : 'ghế'}
                      </div>
                    </div>
                    <input type="color" value={tier.color}
                      onChange={e => {
                        const nc = e.target.value;
                        setTiers(prev => prev.map(t => t.name === tier.name ? { ...t, color: nc } : t));
                        if (activeTier?.name === tier.name) setActiveTier(a => ({ ...a, color: nc }));
                        setCellMap(prev => { const n = { ...prev }; Object.entries(n).forEach(([k, v]) => { if (v?.tier === tier.name) n[k] = { ...v, color: nc }; }); return n; });
                      }}
                      onClick={e => e.stopPropagation()} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, opacity: 0.7 }} />
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#141414', borderRadius: '10px', padding: '14px', border: '1px solid #1a1a1a', marginBottom: '14px' }}>
              <div style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Thống kê</div>
              {[['Tổng ô', seatStats.total, '#eee'], ['Đã phân hạng', Object.values(seatStats.byTier).reduce((a, b) => a + b, 0), '#2CC275'], ['Chưa phân', seatStats.unpainted, '#FFC107'], ['Lối đi', seatStats.disabled, '#555']].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>{label}</span><strong style={{ color }}>{val}</strong>
                </div>
              ))}
              {seatStats.unpainted > 0 && <div style={{ marginTop: '10px', background: '#FFC10710', border: '1px solid #FFC10730', borderRadius: '8px', padding: '8px', fontSize: '12px', color: '#FFC107' }}><FaExclamationTriangle style={{ marginRight: "4px" }} /> {seatStats.unpainted} ô chưa được tô</div>}
              {canSubmit && <div style={{ marginTop: '10px', background: '#2CC27510', border: '1px solid #2CC27530', borderRadius: '8px', padding: '8px', fontSize: '12px', color: '#2CC275' }}><FaCheckCircle style={{ marginRight: '6px' }} />{Object.values(seatStats.byTier).reduce((a, b) => a + b, 0)} ghế sẵn sàng</div>}
            </div>
            <div style={{ background: '#141414', borderRadius: '10px', padding: '14px', border: '1px solid #1a1a1a', fontSize: '12px', color: '#555', lineHeight: '1.7' }}>
              <div style={{ color: '#444', fontWeight: '700', marginBottom: '6px' }}>Hướng dẫn</div>
              <div><FaMousePointer style={{ marginRight: "6px" }} /> <strong style={{ color: '#666' }}>Click+kéo</strong> để tô nhiều ghế</div>
              <div><FaEraser style={{ marginRight: "6px" }} /> Dùng <strong style={{ color: '#666' }}>Tẩy</strong> để tạo lối đi</div>
              <div><FaUndo style={{ marginRight: "6px" }} /> <strong style={{ color: '#666' }}>Undo</strong> để hoàn tác</div>
            </div>
          </div>
          <ModalFooter loading={loading} canSubmit={canSubmit} onSubmit={handleSubmitSeat} onClose={onClose} label={`Xuất bản ${Object.values(seatStats.byTier).reduce((a, b) => a + b, 0)} ghế`} />
        </div>
      </div>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────

const ModalHeader = ({ event, label, onBack, onClose }) => (
  <div style={{ padding: '12px 20px', background: '#0f0f0f', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ color: '#2CC275', fontWeight: '700', fontSize: '16px' }}>Seatmap Builder</span>
      <span style={{ color: '#444', fontSize: '13px' }}>— {event.title}</span>
      <span style={{ background: '#2CC27520', color: '#2CC275', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{label}</span>
    </div>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={onBack} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>← Đổi loại</button>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', cursor: 'pointer' }}><FaTimes /></button>
    </div>
  </div>
);

const ModalFooter = ({ loading, canSubmit, onSubmit, onClose, label }) => (
  <div style={{ padding: '14px 16px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: '8px', flexShrink: 0 }}>
    <button onClick={onClose} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', padding: '11px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Hủy</button>
    <button onClick={onSubmit} disabled={loading || !canSubmit}
      style={{ flex: 2, background: canSubmit && !loading ? '#2CC275' : '#222', border: 'none', color: canSubmit && !loading ? '#000' : '#555', padding: '11px', borderRadius: '8px', cursor: canSubmit && !loading ? 'pointer' : 'not-allowed', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
      {loading ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} />Đang lưu...</> : <><FaSave />{label || 'Xuất bản'}</>}
    </button>
  </div>
);

const ZoneList = ({ zones, onDelete, onEdit }) => (
  <div>
    <div style={{ color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Zones ({zones.length})</div>
    {zones.length === 0 && <p style={{ color: '#444', fontSize: '13px' }}>Click vào SVG để thêm zone</p>}
    {zones.map((z, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161616', padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', borderLeft: `3px solid ${z.color}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#eee', fontWeight: '600', fontSize: '13px' }}>{z.name}</div>
          <div style={{ color: '#666', fontSize: '11px' }}>{z.capacity} chỗ · {new Intl.NumberFormat('vi-VN').format(z.price)}đ</div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {onEdit && <button onClick={() => onEdit(z)} style={{ background: 'none', border: 'none', color: '#1890ff', cursor: 'pointer', padding: '4px', fontSize: '12px' }} title="Sửa"><FaEdit /></button>}
          <button onClick={() => onDelete(z.svg_id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer' }} title="Xóa"><FaTimes /></button>
        </div>
      </div>
    ))}
  </div>
);

const UploadSvgPlaceholder = ({ onUpload, desc }) => (
  <div style={{ textAlign: 'center', padding: '40px' }}>
    <div style={{ border: '2px dashed #2a2a2a', padding: '40px', borderRadius: '14px', background: '#0d0d0d' }}>
      <FaUpload style={{ fontSize: '36px', color: '#444', display: 'block', margin: '0 auto 14px' }} />
      <h3 style={{ margin: '0 0 8px 0', color: '#eee', fontSize: '15px' }}>Upload SVG sơ đồ sân khấu</h3>
      <p style={{ color: '#555', fontSize: '13px', marginBottom: '8px' }}>{desc || 'File .svg vector'}</p>
      <label style={{ background: '#2CC275', color: '#000', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
        Chọn SVG <input type="file" accept=".svg" onChange={onUpload} style={{ display: 'none' }} />
      </label>
    </div>
  </div>
);

/**
 * TicketReferencePanel — Shows existing ticket types from event creation
 * for quick reference and one-click auto-fill into forms.
 */
const TicketReferencePanel = ({ tickets, loading, onApply, targetLabel = 'mục', compact = false, showAddNew = false }) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) return null;
  if (!tickets || tickets.length === 0) return null;

  return (
    <div style={{
      background: compact ? '#0d0d0d' : '#111',
      border: '1px solid #1e3a28',
      borderRadius: compact ? '8px' : '10px',
      marginBottom: compact ? '10px' : '16px',
      overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      {/* Toggle Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: compact ? '8px 10px' : '10px 14px',
          cursor: 'pointer', transition: 'background 0.15s',
          background: expanded ? '#1a2e20' : 'transparent',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#0f1a14'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaInfoCircle style={{ color: '#2CC275', fontSize: compact ? '11px' : '12px', flexShrink: 0 }} />
          <span style={{ color: '#2CC275', fontSize: compact ? '11px' : '12px', fontWeight: '600' }}>
            Vé đã tạo ({tickets.length})
          </span>
        </div>
        <span style={{ color: '#555', fontSize: '10px', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
          ▶
        </span>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: compact ? '6px 10px 10px' : '8px 14px 14px' }}>
          <div style={{ color: '#555', fontSize: '10px', marginBottom: '8px', lineHeight: '1.5' }}>
            Click vào loại vé để tự động điền tên và giá vào {targetLabel}
          </div>
          {tickets.map((ticket, i) => (
            <div
              key={ticket.id || i}
              onClick={() => onApply(ticket, undefined)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: compact ? '7px 8px' : '8px 10px',
                background: '#141414', borderRadius: '6px',
                marginBottom: '4px', cursor: 'pointer',
                border: '1px solid #1a1a1a',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#2CC275';
                e.currentTarget.style.background = '#1a2e20';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#1a1a1a';
                e.currentTarget.style.background = '#141414';
              }}
            >
              <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: ticket.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#ddd', fontSize: compact ? '12px' : '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ticket.name}
                </div>
                <div style={{ color: '#666', fontSize: '10px' }}>
                  {new Intl.NumberFormat('vi-VN').format(ticket.price)}đ · SL: {ticket.quantity}
                </div>
              </div>
              <FaArrowRight style={{ color: '#2CC275', fontSize: '10px', flexShrink: 0, opacity: 0.6 }} />
            </div>
          ))}
          {showAddNew && tickets.length > 0 && (
            <div style={{ color: '#555', fontSize: '10px', marginTop: '6px', textAlign: 'center', fontStyle: 'italic' }}>
              Click để thêm {targetLabel} mới từ vé đã tạo
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeatmapBuilderModal;
