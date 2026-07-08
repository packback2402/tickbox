import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import SeatmapBuilderModal from '../components/SeatmapBuilderModal';
import SeatmapViewerModal from '../components/SeatmapViewerModal';
import { FaTrash, FaPlus, FaStar, FaEdit, FaTimes, FaSave, FaCheck, FaBan, FaUsers, FaHandshake, FaChartLine, FaChartBar, FaDownload, FaFilter, FaClock, FaMapMarkerAlt, FaTag, FaUser, FaSearch, FaChevronDown, FaFileAlt, FaMapMarked, FaTicketAlt, FaShieldAlt, FaArrowRight, FaArrowLeft, FaList, FaCalendarPlus, FaEye, FaBold, FaItalic, FaUnderline, FaStrikethrough, FaListUl, FaListOl, FaQuoteLeft, FaImage, FaUndo, FaRedo, FaGlobe, FaExternalLinkAlt } from "react-icons/fa";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const DRAFT_KEY = 'admin_event_draft';

// Rich Text Editor
const RichEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const isInitialized = useRef(false);
  // Track active format states
  const [activeFormats, setActiveFormats] = useState({});

  // Init content only once
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value || '';
      isInitialized.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync if value reset externally (e.g. editing new event)
  useEffect(() => {
    if (editorRef.current && (value === '' || value === null || value === undefined) && isInitialized.current) {
      editorRef.current.innerHTML = '';
    }
  }, [value]);

  // Poll active format states on selection/cursor change
  const updateActiveFormats = useCallback(() => {
    try {
      const formats = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      };
      // Check block type
      const block = document.queryCommandValue('formatBlock').toLowerCase();
      formats.blockH2 = block === 'h2';
      formats.blockH3 = block === 'h3';
      formats.blockQuote = block === 'blockquote';
      setActiveFormats(formats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats);
    return () => document.removeEventListener('selectionchange', updateActiveFormats);
  }, [updateActiveFormats]);

  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleChange();
    setTimeout(updateActiveFormats, 0);
  };

  const handleChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertImage = () => {
    if (!imageUrl.trim()) return;
    exec('insertHTML', `<img src="${imageUrl}" alt="" style="max-width:100%;border-radius:8px;margin:8px 0;" />`);
    setImageUrl('');
    setShowImageInput(false);
  };

  // Toolbar button with active state highlight
  const ToolBtn = ({ cmd, val, icon, title, isActive }) => {
    const active = isActive ?? false;
    return (
      <button
        type="button"
        title={title}
        onMouseDown={e => { e.preventDefault(); exec(cmd, val); }}
        style={{
          background: active ? '#2CC27530' : 'transparent',
          border: active ? '1px solid #2CC27580' : '1px solid transparent',
          color: active ? '#2CC275' : '#888',
          padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
          fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: '30px', height: '30px',
          transition: 'all 0.12s',
          fontWeight: active ? '700' : '400',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.color = '#fff'; } }}
        onMouseLeave={e => {
          e.currentTarget.style.background = active ? '#2CC27530' : 'transparent';
          e.currentTarget.style.color = active ? '#2CC275' : '#888';
        }}
      >{icon}</button>
    );
  };

  const Divider = () => <div style={{ width: '1px', height: '20px', background: '#333', margin: '0 2px', flexShrink: 0 }} />;

  return (
    <div style={{ border: '1px solid #333', borderRadius: '10px', overflow: 'hidden', background: '#181818' }}
      onFocusCapture={e => e.currentTarget.style.borderColor = '#2CC275'}
      onBlurCapture={e => e.currentTarget.style.borderColor = '#333'}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '8px 10px', borderBottom: '1px solid #252525', background: '#1e1e1e', alignItems: 'center' }}>
        {/* Inline formats */}
        <ToolBtn cmd="bold" icon={<FaBold />} title="In đậm (Ctrl+B)" isActive={activeFormats.bold} />
        <ToolBtn cmd="italic" icon={<FaItalic />} title="In nghiêng (Ctrl+I)" isActive={activeFormats.italic} />
        <ToolBtn cmd="underline" icon={<FaUnderline />} title="Gạch chân (Ctrl+U)" isActive={activeFormats.underline} />
        <ToolBtn cmd="strikeThrough" icon={<FaStrikethrough />} title="Gạch ngang" isActive={activeFormats.strikeThrough} />
        <Divider />
        {/* Block formats */}
        <ToolBtn cmd="formatBlock" val="h2" icon={<span style={{fontSize:'11px',fontWeight:'800',fontFamily:'monospace'}}>H2</span>} title="Tiêu đề lớn" isActive={activeFormats.blockH2} />
        <ToolBtn cmd="formatBlock" val="h3" icon={<span style={{fontSize:'11px',fontWeight:'800',fontFamily:'monospace'}}>H3</span>} title="Tiêu đề nhỏ" isActive={activeFormats.blockH3} />
        <ToolBtn cmd="formatBlock" val="p" icon={<span style={{fontSize:'12px',fontWeight:'600'}}>¶</span>} title="Đoạn văn bình thường" />
        <Divider />
        {/* Lists */}
        <ToolBtn cmd="insertUnorderedList" icon={<FaListUl />} title="Danh sách gạch đầu dòng" isActive={activeFormats.insertUnorderedList} />
        <ToolBtn cmd="insertOrderedList" icon={<FaListOl />} title="Danh sách số thứ tự" isActive={activeFormats.insertOrderedList} />
        <ToolBtn cmd="formatBlock" val="blockquote" icon={<FaQuoteLeft />} title="Trích dẫn" isActive={activeFormats.blockQuote} />
        <Divider />
        {/* Image */}
        <button
          type="button" title="Chèn ảnh"
          onMouseDown={e => { e.preventDefault(); setShowImageInput(v => !v); }}
          style={{
            background: showImageInput ? '#1890ff20' : 'transparent',
            border: showImageInput ? '1px solid #1890ff60' : '1px solid transparent',
            color: showImageInput ? '#1890ff' : '#888',
            padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            minWidth: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><FaImage /></button>
        <div style={{ flex: 1 }} />
        {/* Undo/Redo */}
        <ToolBtn cmd="undo" icon={<FaUndo />} title="Hoàn tác (Ctrl+Z)" />
        <ToolBtn cmd="redo" icon={<FaRedo />} title="Làm lại (Ctrl+Y)" />
      </div>

      {/* Image URL input bar */}
      {showImageInput && (
        <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: '#141414', borderBottom: '1px solid #252525', alignItems: 'center' }}>
          <FaGlobe size={12} style={{ color: '#1890ff', flexShrink: 0 }} />
          <input
            type="url" placeholder="Dán URL ảnh vào đây..."
            value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && insertImage()}
            autoFocus
            style={{ flex: 1, background: '#1e1e1e', border: '1px solid #333', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
          />
          <button type="button" onClick={insertImage}
            style={{ background: '#1890ff', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
            Chèn
          </button>
          <button type="button" onClick={() => setShowImageInput(false)}
            style={{ background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
            <FaTimes />
          </button>
        </div>
      )}

      {/* Editable content area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleChange}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setTimeout(() => {
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const tmp = document.createElement('span');
                tmp.innerHTML = '\u200b';
                range.insertNode(tmp);
                tmp.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
              }
            }, 10);
          }
        }}
        data-placeholder={placeholder || 'Mô tả chi tiết về sự kiện...'}
        style={{
          minHeight: '200px', maxHeight: '380px', overflowY: 'auto',
          padding: '14px 16px 14px 32px', outline: 'none', color: '#d4d4d4',
          fontSize: '14px', lineHeight: '1.75', wordBreak: 'break-word',
          borderRadius: '0 0 10px 10px',
        }}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #444;
          pointer-events: none;
          display: block;
        }
        [contenteditable] h2 {
          color: #fff; font-size: 1.25em; font-weight: 700;
          margin: 14px 0 6px; border-bottom: 1px solid #2a2a2a; padding-bottom: 5px;
        }
        [contenteditable] h3 {
          color: #e0e0e0; font-size: 1.08em; font-weight: 600; margin: 10px 0 4px;
        }
        [contenteditable] blockquote {
          border-left: 3px solid #2CC275; padding: 8px 16px;
          margin: 10px 0; color: #999; background: #2CC27510;
          border-radius: 0 8px 8px 0; font-style: italic;
        }
        [contenteditable] ul {
          padding-left: 1.4em; margin: 6px 0;
          list-style-type: disc; list-style-position: outside;
        }
        [contenteditable] ol {
          padding-left: 1.6em; margin: 6px 0;
          list-style-type: decimal; list-style-position: outside;
        }
        [contenteditable] li {
          margin: 3px 0; color: #d4d4d4; display: list-item;
        }
        [contenteditable] img {
          max-width: 100%; border-radius: 8px; display: block; margin: 10px 0;
        }
        [contenteditable] strong, [contenteditable] b {
          color: #fff; font-weight: 700;
        }
        [contenteditable] em, [contenteditable] i {
          color: #d0d0d0;
        }
        [contenteditable] a {
          color: #2CC275; text-decoration: underline;
        }
        [contenteditable] p { margin: 6px 0; }
      `}</style>
    </div>
  );
};


// Action Dropdown (Gọn, có mục đích rõ ràng)
const ActionDropdown = ({ event, onView, onApprove, onReject, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const actions = [
    { label: 'Xem chi tiết', icon: <FaEye />, color: '#1890ff', bg: '#1890ff15',
      onClick: () => { onView(event); setOpen(false); } },
    { label: 'Phân bổ vé', icon: <FaTicketAlt />, color: '#2CC275', bg: '#2CC27515',
      onClick: () => { navigate(`/admin/events/${event.id}/manage?tab=allocate`); setOpen(false); } },
    { label: 'Phân tích', icon: <FaChartBar />, color: '#a78bfa', bg: '#a78bfa15',
      onClick: () => { navigate(`/organizer/event/${event.id}/analytics`); setOpen(false); } },
    ...(event.status === 'pending' ? [
      { label: 'Duyệt sự kiện', icon: <FaCheck />, color: '#2CC275', bg: '#2CC27515',
        onClick: () => { onApprove(event.id); setOpen(false); } },
      { label: 'Từ chối', icon: <FaBan />, color: '#ff7875', bg: '#ff4d4f15',
        onClick: () => { onReject(event.id); setOpen(false); } },
    ] : []),
    { label: 'Xóa sự kiện', icon: <FaTrash />, color: '#ff4d4f', bg: '#ff4d4f15', divider: true,
      onClick: () => { onDelete(event.id); setOpen(false); } },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: open ? '#2a2a2a' : '#1e1e1e', border: '1px solid #3a3a3a', color: '#ccc', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#ccc'; } }}
      >
        Hành động <FaChevronDown size={10} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', minWidth: '190px', zIndex: 999, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', overflow: 'hidden', animation: 'dropdownFadeIn 0.15s ease' }}>
          <div style={{ padding: '5px' }}>
            {actions.map((action, i) => (
              <React.Fragment key={i}>
                {action.divider && <div style={{ height: '1px', background: '#1e1e1e', margin: '4px 0' }} />}
                <button
                  onClick={action.onClick}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: action.color, padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', textAlign: 'left', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = action.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '12px', width: '16px', textAlign: 'center', flexShrink: 0 }}>{action.icon}</span>
                  {action.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Event Detail Modal
const EventDetailModal = ({ event, onClose, onEdit, onApprove, onReject, onDelete }) => {
  const [tab, setTab] = useState('info');
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTab('info');
    setLoadingTickets(true);
    api.get(`/api/tickets/${event.id}`)
      .then(res => setTickets(res.data))
      .catch(() => setTickets([]))
      .finally(() => setLoadingTickets(false));
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) return null;

  const statusMap = {
    published: { color: '#2CC275', bg: '#2CC27520', text: 'Đã đăng' },
    pending:   { color: '#FFC107', bg: '#FFC10720', text: 'Chờ duyệt' },
    rejected:  { color: '#ff4d4f', bg: '#ff4d4f20', text: 'Đã từ chối' },
  };
  const s = statusMap[event.status] || statusMap.pending;

  const tabStyle = (id) => ({
    background: tab === id ? '#2CC27520' : 'transparent',
    color: tab === id ? '#2CC275' : '#666',
    border: tab === id ? '1px solid #2CC27530' : '1px solid transparent',
    padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '12px', fontWeight: '700', transition: 'all 0.15s',
  });

  const formatCurr = (v) => v != null ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '—';

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}
    >
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '20px', width: '100%', maxWidth: '760px', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ height: '180px', overflow: 'hidden', borderRadius: '20px 20px 0 0' }}>
            <img src={event.image_url?.startsWith('http') ? event.image_url : `http://localhost:5001${event.image_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55)' }} onError={e => e.target.src='https://via.placeholder.com/760x180/1a1a1a/333?text=No+Image'} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #141414)' }} />
          </div>
          <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><FaTimes /></button>
          <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ background: s.bg, color: s.color, fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', border: `1px solid ${s.color}40`, display: 'inline-block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.text}</span>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: '800', lineHeight: '1.2', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{event.title}</h2>
              </div>
              <button
                onClick={() => { onEdit(event); onClose(); }}
                style={{ background: 'linear-gradient(135deg, #FFC107, #e6a800)', color: '#000', border: 'none', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}
              ><FaEdit size={12} /> Chỉnh sửa</button>
            </div>
          </div>
        </div>

        {/* Quick info bar */}
        <div style={{ display: 'flex', gap: '20px', padding: '14px 20px', borderBottom: '1px solid #1e1e1e', flexWrap: 'wrap', flexShrink: 0 }}>
          {[
            { icon: <FaClock size={11} />, text: new Date(event.event_date).toLocaleString('vi-VN') },
            { icon: <FaMapMarkerAlt size={11} />, text: event.location },
            { icon: <FaUser size={11} />, text: event.organizer || '—' },
            { icon: <FaTag size={11} />, text: event.category_name || '—' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '12px' }}>
              <span style={{ color: '#2CC275' }}>{item.icon}</span>{item.text}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 20px 0', flexShrink: 0, flexWrap: 'wrap' }}>
          {[['info','Thông tin'],['tickets','Hạng vé'],['license','Minh chứng & TT'],['actions','Hành động']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={tabStyle(id)}>{label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
          {tab === 'info' && (
            <div>
              <div style={{ fontSize: '12px', color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Mô tả sự kiện</div>
              {event.description ? (
                <div
                  dangerouslySetInnerHTML={{ __html: event.description }}
                  className="event-description-html"
                  style={{ color: '#bbb', fontSize: '14px', lineHeight: '1.7' }}
                />
              ) : (
                <div style={{ color: '#444', fontStyle: 'italic', fontSize: '13px' }}>Không có mô tả</div>
              )}
            </div>
          )}

          {tab === 'tickets' && (
            <div>
              {loadingTickets ? (
                <div style={{ color: '#555', textAlign: 'center', padding: '30px' }}>Đang tải...</div>
              ) : tickets.length === 0 ? (
                <div style={{ color: '#444', textAlign: 'center', padding: '30px', fontStyle: 'italic', fontSize: '13px' }}>Chưa có hạng vé nào</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tickets.map((t, i) => (
                    <div key={i} style={{ background: '#1a1a1a', border: '1px solid #252525', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>{t.type}</div>
                        <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>Tổng: {t.quantity_available} vé</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#2CC275', fontWeight: '800', fontSize: '16px' }}>{t.price === 0 ? 'Miễn phí' : formatCurr(t.price)}</div>
                        <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>Đã bán: {t.quantity_sold || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'license' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Minh chứng cấp phép */}
              <div style={{ background: '#1a1a1a', border: '1px solid #252525', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '11px', color: '#FFC107', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Minh chứng cấp phép
                </div>
                <div style={{ color: '#bbb', fontSize: '13px', lineHeight: '1.7', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                  {event.license_note || <span style={{ color: '#444', fontStyle: 'italic' }}>Không có ghi chú</span>}
                </div>
                {/* File minh chứng */}
                {(() => {
                  // Safe parse: license_files có thể là array hoặc JSON string
                  let files = event.license_files;
                  if (typeof files === 'string') {
                    try { files = JSON.parse(files); } catch { files = []; }
                  }
                  if (!Array.isArray(files)) files = [];
                  return files.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', marginBottom: '4px' }}>File đính kèm ({files.length}):</div>
                      {files.map((url, i) => {
                        const filename = url.split('/').pop();
                        const isPdf = filename.toLowerCase().endsWith('.pdf');
                        const backendBase = process.env.NODE_ENV === 'production'
                          ? (process.env.REACT_APP_API_URL ?? window.location.origin)
                          : (process.env.REACT_APP_API_URL || 'http://localhost:5001');
                        const fullUrl = url.startsWith('http') ? url : `${backendBase}${url}`;
                        return (
                          <a key={i} href={fullUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', borderRadius: '8px', padding: '10px 14px', border: '1px solid #2a2a2a', textDecoration: 'none', color: '#ccc', fontSize: '13px' }}>
                            <span style={{ color: isPdf ? '#ff6b6b' : '#2CC275' }}>📄</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
                            <span style={{ color: '#444', fontSize: '11px' }}>Xem ↗</span>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: '#444', fontStyle: 'italic', fontSize: '13px' }}>Chưa có file minh chứng</div>
                  );
                })()}
              </div>

              {/* Thông tin thanh toán */}
              <div style={{ background: '#1a1a1a', border: '1px solid #252525', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '11px', color: '#2CC275', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Thông tin ngân hàng</div>
                {event.bank_account_number ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'Chủ tài khoản', value: event.bank_account_holder },
                      { label: 'Số tài khoản', value: event.bank_account_number },
                      { label: 'Ngân hàng', value: event.bank_name },
                      { label: 'Chi nhánh', value: event.bank_branch },
                    ].map(({ label, value }, i) => (
                      <div key={i} style={{ background: '#111', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', marginBottom: '3px' }}>{label}</div>
                        <div style={{ color: '#ddd', fontSize: '14px', fontWeight: '600' }}>{value || '—'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#444', fontStyle: 'italic', fontSize: '13px' }}>Chưa có thông tin tài khoản</div>
                )}
              </div>
            </div>
          )}

          {tab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {event.status === 'pending' && (
                <>
                  <div style={{ fontSize: '12px', color: '#FFC107', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaStar size={11} /> Sự kiện đang chờ xét duyệt từ Organizer
                  </div>
                  <button
                    onClick={() => { onApprove(event.id); onClose(); }}
                    style={{ background: 'linear-gradient(135deg, #2CC275, #1da562)', color: '#fff', border: 'none', padding: '13px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(44,194,117,0.3)' }}
                  ><FaCheck /> Duyệt sự kiện này</button>
                  <button
                    onClick={() => { onReject(event.id); onClose(); }}
                    style={{ background: '#ff4d4f15', color: '#ff7875', border: '1px solid #ff4d4f40', padding: '13px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}
                  ><FaBan /> Từ chối sự kiện này</button>
                  <div style={{ height: '1px', background: '#1e1e1e', margin: '4px 0' }} />
                </>
              )}
              <button
                onClick={() => { onDelete(event.id); onClose(); }}
                style={{ background: '#ff4d4f10', color: '#ff4d4f', border: '1px solid #ff4d4f30', padding: '13px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}
              ><FaTrash /> Xóa sự kiện này</button>
              {event.status === 'published' && (
                <a href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ background: '#1a1a1a', color: '#1890ff', border: '1px solid #1890ff30', padding: '13px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
                ><FaExternalLinkAlt size={12} /> Xem trang sự kiện</a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Step Indicator
const STEPS = [
  { id: 1, label: 'Thông tin', icon: <FaFileAlt size={12} /> },
  { id: 2, label: 'Hạng vé', icon: <FaTicketAlt size={12} /> },
  { id: 3, label: 'Sơ đồ chỗ ngồi', icon: <FaMapMarked size={12} /> },
  { id: 4, label: 'Cài đặt', icon: <FaShieldAlt size={12} /> },
];

const StepIndicator = ({ current, onStepClick }) => (
  <div style={{ display: 'flex', gap: '0', marginBottom: '28px', background: '#1a1a1a', borderRadius: '12px', padding: '6px', border: '1px solid #2a2a2a' }}>
    {STEPS.map((step) => {
      const done = current > step.id;
      const active = current === step.id;
      return (
        <button key={step.id} onClick={() => onStepClick && onStepClick(step.id)} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '10px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: active ? '#2CC275' : 'transparent',
          color: active ? '#000' : done ? '#2CC275' : '#555',
          fontWeight: active ? '700' : '500', fontSize: '13px', transition: 'all 0.2s',
        }}>
          {done ? <FaCheck size={11} /> : step.icon} {step.label}
        </button>
      );
    })}
  </div>
);



// Main Component
const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('events_list');
  const [dateRange, setDateRange] = useState('all');

  // Events state
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [eventData, setEventData] = useState({
    title: '', description: '', location: '', image_url: '',
    event_date: '', end_date: '', organizer: '', category_id: '', is_featured: false
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [ticketRows, setTicketRows] = useState([{ type: 'Vé Thường', price: '', quantity_available: 100, max_per_order: 10 }]);
  const [deletedTicketIds, setDeletedTicketIds] = useState([]);

  // Wizard step state
  const [wizardStep, setWizardStep] = useState(1);
  const [licenseFiles, setLicenseFiles] = useState([]); // new File objects to upload
  const [existingLicenseUrls, setExistingLicenseUrls] = useState([]); // already-saved URLs
  const [licenseNote, setLicenseNote] = useState('');
  const [hasSeatMap, setHasSeatMap] = useState(false);
  const [seatmapConfig, setSeatmapConfig] = useState({ rows: 10, cols: 15, sections: [] });
  const [showSeatmapBuilder, setShowSeatmapBuilder] = useState(false); // fullscreen builder
  const [seatmapBuilderIsEditing, setSeatmapBuilderIsEditing] = useState(false); // true when editing existing seatmap
  const [showSeatmapViewer, setShowSeatmapViewer] = useState(false);   // viewer modal
  const [tempCreatedEventId, setTempCreatedEventId] = useState(null); // draft event for new flow
  const [seatmapDone, setSeatmapDone] = useState(false); // track if seatmap was saved

  // Draft auto-save
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftTimerRef = useRef(null);

  // Event detail modal
  const [viewingEvent, setViewingEvent] = useState(null);

  // Payment & invoice info (Step 4)
  const [paymentInfo, setPaymentInfo] = useState({
    accountHolder: '', accountNumber: '', bankName: '', branch: ''
  });
  const [invoiceInfo, setInvoiceInfo] = useState({
    businessType: 'personal', fullName: '', address: '', taxCode: '', companyName: ''
  });
  const [wantInvoice, setWantInvoice] = useState(false);

  // Event list search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Admin data
  const [pendingEvents, setPendingEvents] = useState([]);
  const [organizerRequests, setOrganizerRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const [revenueEventsData, setRevenueEventsData] = useState([]);

  // Detailed analytics states
  const [revenueDetailed, setRevenueDetailed] = useState([]);
  const [revenueByHour, setRevenueByHour] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [revenueByTicketType, setRevenueByTicketType] = useState([]);
  const [revenueByCategory, setRevenueByCategory] = useState([]);
  const [topOrganizers, setTopOrganizers] = useState([]);
  const [platformSummary, setPlatformSummary] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [ticketsSoldStats, setTicketsSoldStats] = useState(null);
  // Admin drill-down
  const [drillEvent, setDrillEvent] = useState(null);
  const [drillOrders, setDrillOrders] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillSearch, setDrillSearch] = useState('');
  const [drillTicketFilter, setDrillTicketFilter] = useState('all');

  // Detail modals for pending events and organizer requests
  const [viewingPendingEvent, setViewingPendingEvent] = useState(null); // { event, tickets }
  const [viewingOrgRequest, setViewingOrgRequest] = useState(null);    // request object
  const [descExpanded, setDescExpanded] = useState(false); // collapse mô tả

  const fetchDrillOrders = async (eventId) => {
    setDrillLoading(true);
    try {
      const res = await api.get(`/api/admin/event-orders/${eventId}`);
      setDrillOrders(res.data);
    } catch (err) { console.error(err); }
    finally { setDrillLoading(false); }
  };

  const exportDrillCSV = () => {
    if (!drillOrders.length) return;
    const headers = 'Mã đơn,Email,Tên,Loại vé,SL,Đơn giá,Thành tiền,Phí nền tảng,Ngày mua';
    const rows = drillOrders.map(o =>
      `"${o.order_code}","${o.customer_email}","${o.customer_name || ''}","${o.ticket_type}",${o.quantity_ordered},${o.price_at_purchase},${o.subtotal},${o.platform_fee},"${new Date(o.purchased_at).toLocaleString('vi-VN')}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders-event-${drillEvent?.event_id}.csv`;
    link.click();
  };

  // Fetch functions
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/all-events');
      setEvents(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/api/categories');
      setCategories(res.data);
      if (res.data.length > 0 && !editingId) {
        setEventData(prev => ({ ...prev, category_id: res.data[0].id }));
      }
    } catch (err) { console.error(err); }
  }, [editingId]);

  const fetchPendingEvents = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/pending-events');
      setPendingEvents(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrganizerRequests = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/organizer-requests');
      setOrganizerRequests(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/stats?range=${dateRange}`);
      setStats(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchRevenueChartData = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/revenue-chart?range=${dateRange}`);
      setRevenueChartData(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchRevenueEventsData = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/revenue-events?range=${dateRange}`);
      setRevenueEventsData(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchRevenueDetailed = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/revenue-detailed?range=${dateRange}`);
      setRevenueDetailed(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchRevenueByTicketType = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/revenue-by-ticket-type?range=${dateRange}`);
      setRevenueByTicketType(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchRevenueByCategory = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/revenue-by-category?range=${dateRange}`);
      setRevenueByCategory(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchRevenueByHour = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/revenue-by-hour?range=${dateRange}`);
      setRevenueByHour(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchTopOrganizers = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/top-organizers?range=${dateRange}&limit=10`);
      setTopOrganizers(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchPlatformSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/platform-summary');
      setPlatformSummary(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/payment-methods?range=${dateRange}`);
      setPaymentMethods(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  const fetchTicketsSoldStats = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/tickets-sold-stats?range=${dateRange}`);
      setTicketsSoldStats(res.data);
    } catch (err) { console.error(err); }
  }, [dateRange]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
      alert("Bạn không có quyền truy cập!");
      navigate('/');
      return;
    }
    fetchEvents();
    fetchCategories();
    fetchPendingEvents();
    fetchOrganizerRequests();
    fetchUsers();
    fetchStats();
    fetchRevenueChartData();
    fetchRevenueEventsData();
    fetchRevenueDetailed();
    fetchRevenueByTicketType();
    fetchRevenueByHour();
    fetchRevenueByCategory();
    fetchTopOrganizers();
    fetchPlatformSummary();
    fetchPaymentMethods();
    fetchTicketsSoldStats();
  }, [navigate, fetchEvents, fetchCategories, fetchPendingEvents, fetchOrganizerRequests, fetchUsers, fetchStats, fetchRevenueChartData, fetchRevenueEventsData, fetchRevenueDetailed, fetchRevenueByTicketType, fetchRevenueByHour, fetchRevenueByCategory, fetchTopOrganizers, fetchPlatformSummary, fetchPaymentMethods, fetchTicketsSoldStats, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved && !editingId) {
        const draft = JSON.parse(saved);
        if (draft.eventData) setEventData(d => ({ ...d, ...draft.eventData }));
        if (draft.ticketRows) setTicketRows(draft.ticketRows);
        if (draft.wizardStep) setWizardStep(draft.wizardStep);
        if (draft.hasSeatMap !== undefined) setHasSeatMap(draft.hasSeatMap);
        if (draft.seatmapConfig) setSeatmapConfig(draft.seatmapConfig);
        if (draft.licenseNote) setLicenseNote(draft.licenseNote);
        if (draft.savedAt) setDraftSavedAt(new Date(draft.savedAt));
      }
    } catch (e) { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on change (debounced 1.5s), only when in create mode
  useEffect(() => {
    if (editingId) return; // Don't draft-save when editing
    const hasContent = eventData.title || eventData.location || eventData.organizer;
    if (!hasContent) return;
    setDraftSaving(true);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        const draft = { eventData, ticketRows, wizardStep, hasSeatMap, seatmapConfig, licenseNote, savedAt: new Date().toISOString() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setDraftSavedAt(new Date());
      } catch (e) { /* ignore */ }
      setDraftSaving(false);
    }, 1500);
    return () => clearTimeout(draftTimerRef.current);
  }, [eventData, ticketRows, wizardStep, hasSeatMap, seatmapConfig, licenseNote, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftSavedAt(null);
  };

  const formatDateForInput = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date - offset)).toISOString().slice(0, 16);
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '';
    // Strip decimal part first (DB returns NUMERIC as "500000.00")
    const intVal = Math.round(parseFloat(String(value).replace(/,/g, '')) || 0);
    if (isNaN(intVal) || intVal === 0) return '';
    return new Intl.NumberFormat('vi-VN').format(intVal);
  };

  const parseCurrency = (value) => {
    if (!value && value !== 0) return 0;
    // Remove thousands separators (dots in vi-VN), keep only digits
    const cleaned = String(value).replace(/\./g, '').replace(/,/g, '').trim();
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : Math.min(num, 99999999); // max 8 digits for NUMERIC(10,2)
  };

  const handleTicketChange = (index, field, value) => {
    const newTickets = [...ticketRows];
    if (field === 'price') {
      const rawValue = value.replace(/\./g, '');
      if (!isNaN(rawValue)) newTickets[index][field] = formatCurrency(rawValue);
    } else if (field === 'max_per_order') {
      const qty = parseInt(newTickets[index].quantity_available) || 1;
      const maxVal = Math.min(parseInt(value) || 1, qty);
      newTickets[index][field] = maxVal;
    } else if (field === 'quantity_available') {
      newTickets[index][field] = value;
      // Auto-adjust max_per_order if it exceeds new quantity
      const newQty = parseInt(value) || 1;
      const currentMax = parseInt(newTickets[index].max_per_order) || 10;
      if (currentMax > newQty) newTickets[index].max_per_order = newQty;
    } else {
      newTickets[index][field] = value;
    }
    setTicketRows(newTickets);
  };

  const resetWizard = () => {
    setWizardStep(1);
    setEditingId(null);
    setEventData({
      title: '', description: '', location: '', image_url: '',
      event_date: '', end_date: '', organizer: '',
      category_id: categories.length > 0 ? categories[0].id : '', is_featured: false
    });
    setTicketRows([{ type: 'Vé Thường', price: '', quantity_available: 100 }]);
    setIsAddingCategory(false);
    setLicenseFiles([]);
    setExistingLicenseUrls([]);
    setLicenseNote('');
    setHasSeatMap(false);
    setSeatmapConfig({ rows: 10, cols: 15, sections: [] });
    setSeatmapDone(false);
    setTempCreatedEventId(null);
    setShowSeatmapBuilder(false);
    setShowSeatmapViewer(false);
    clearDraft();
    setDraftSavedAt(null);
  };


  const handleEditClick = async (event) => {
    setActiveTab('events_create');
    setEditingId(event.id);
    setEventData({
      title: event.title, description: event.description || '',
      location: event.location, image_url: event.image_url,
      event_date: formatDateForInput(event.event_date),
      end_date: formatDateForInput(event.end_date),
      organizer: event.organizer || '', category_id: event.category_id,
      is_featured: event.is_featured
    });
    setIsAddingCategory(false);
    setWizardStep(1);
    setLicenseFiles([]);
    setExistingLicenseUrls([]);
    setLicenseNote('');

    // Load tickets for this event
    try {
      const tkRes = await api.get(`/api/tickets/${event.id}`);
      const loaded = tkRes.data.map(t => ({
        id: t.id,
        type: t.type,
        price: formatCurrency(Math.round(parseFloat(t.price) || 0)),
        quantity_available: t.quantity_available,
        max_per_order: t.max_per_order || 10,
      }));
      setTicketRows(loaded.length > 0 ? loaded : [{ type: 'Vé Thường', price: '', quantity_available: 100, max_per_order: 10 }]);
      setDeletedTicketIds([]);

      // Fetch full event data (includes Step 4 payment/invoice fields)
      const evRes = await api.get(`/api/events/${event.id}`);
      const ev = evRes.data;
      setPaymentInfo({
        accountHolder: ev.bank_account_holder || '',
        accountNumber: ev.bank_account_number || '',
        bankName: ev.bank_name || '',
        branch: ev.bank_branch || '',
      });
      setWantInvoice(ev.want_invoice || false);
      setInvoiceInfo({
        businessType: ev.invoice_business_type || 'personal',
        fullName: ev.invoice_full_name || '',
        companyName: ev.invoice_company_name || '',
        taxCode: ev.invoice_tax_code || '',
        address: ev.invoice_address || '',
      });
      setLicenseNote(ev.license_note || '');
      // Load existing license file URLs
      const existingFiles = ev.license_files
        ? (typeof ev.license_files === 'string' ? JSON.parse(ev.license_files) : ev.license_files)
        : [];
      setExistingLicenseUrls(Array.isArray(existingFiles) ? existingFiles : []);
    } catch { setTicketRows([{ type: 'Vé Thường', price: '', quantity_available: 100 }]); }

    // Load seatmap config
    setHasSeatMap(!!event.has_seatmap);
    setSeatmapDone(!!event.has_seatmap); // nếu đã có sơ đồ → hiển thị trạng thái "đã lưu"
    setTempCreatedEventId(null);
    if (event.has_seatmap) {
      try {
        const smRes = await api.get(`/api/events/${event.id}/seatmap`);
        if (smRes.data?.rows && smRes.data?.cols) {
          setSeatmapConfig({ rows: smRes.data.rows, cols: smRes.data.cols, sections: smRes.data.sections || [] });
        }
      } catch { setSeatmapConfig({ rows: 10, cols: 15, sections: [] }); }
    } else {
      setSeatmapConfig({ rows: 10, cols: 15, sections: [] });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    if (val === 'new_category_option') {
      setIsAddingCategory(true);
      setEventData(prev => ({ ...prev, category_id: '' }));
    } else {
      setIsAddingCategory(false);
      setEventData(prev => ({ ...prev, category_id: parseInt(val) }));
    }
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) { alert("Vui lòng nhập tên thể loại!"); return; }
    try {
      const res = await api.post('/api/categories', { name: newCategoryName });
      const newCat = res.data;
      setCategories([...categories, newCat]);
      setEventData(prev => ({ ...prev, category_id: newCat.id }));
      setIsAddingCategory(false);
      setNewCategoryName('');
      alert(`Đã thêm thể loại "${newCat.name}"!`);
    } catch (err) { alert("Lỗi khi tạo thể loại."); }
  };

  const handleFinalSubmit = async () => {
    try {
      if (isAddingCategory) { alert('Lưu thể loại mới trước!'); return; }
      if (!eventData.category_id) { alert('Chọn thể loại!'); return; }


      // Step 4 - license: upload new files first, then merge with existing URLs
      let finalLicenseUrls = [...existingLicenseUrls];
      if (licenseFiles.length > 0) {
        const formData = new FormData();
        licenseFiles.forEach(f => formData.append('files', f));
        try {
          const uploadRes = await api.post('/api/upload/license', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          finalLicenseUrls = [...finalLicenseUrls, ...uploadRes.data.urls];
        } catch (uploadErr) {
          console.error('License upload error:', uploadErr);
        }
      }

      const payload = {
        ...eventData,
        category_id: parseInt(eventData.category_id),
        // Step 4 - payment info
        bank_account_holder: paymentInfo.accountHolder || null,
        bank_account_number: paymentInfo.accountNumber || null,
        bank_name: paymentInfo.bankName || null,
        bank_branch: paymentInfo.branch || null,
        // Step 4 - invoice
        want_invoice: wantInvoice,
        invoice_business_type: invoiceInfo.businessType || 'personal',
        invoice_full_name: invoiceInfo.fullName || null,
        invoice_company_name: invoiceInfo.companyName || null,
        invoice_tax_code: invoiceInfo.taxCode || null,
        invoice_address: invoiceInfo.address || null,
        // Step 4 - license
        license_note: licenseNote || null,
        license_files: finalLicenseUrls.length > 0 ? JSON.stringify(finalLicenseUrls) : null,
      };


      if (editingId) {
        // Update basic event info
        await api.put(`/api/events/${editingId}`, payload);

        // Delete tickets removed by user
        for (const tid of deletedTicketIds) {
          await api.delete(`/api/tickets/${tid}`).catch(() => {});
        }
        // Update tickets: PUT existing, POST new
        for (const ticket of ticketRows) {
          if (!ticket.type) continue;
          const ticketPayload = {
            type: ticket.type,
            price: parseCurrency(ticket.price),
            quantity_available: parseInt(ticket.quantity_available) || 0,
            max_per_order: parseInt(ticket.max_per_order) || 10,
          };
          if (ticket.id) {
            // Existing ticket — update in-place
            await api.put(`/api/tickets/${ticket.id}`, ticketPayload).catch(() => {});
          } else {
            // New ticket row added by user — create
            await api.post('/api/tickets', { event_id: editingId, ...ticketPayload });
          }
        }

        // Generate seatmap if configured
        if (hasSeatMap && seatmapConfig.rows && seatmapConfig.cols) {
          try {
            await api.post(`/api/events/${editingId}/generate-seatmap`, {
              rows: seatmapConfig.rows,
              cols: seatmapConfig.cols,
            });
          } catch { /* seatmap not mandatory */ }
        }

        alert("Cập nhật sự kiện thành công!");
      } else {
        let newEventId;
        if (tempCreatedEventId) {
          // Đã có draft event từ seatmap builder → UPDATE thay vì tạo mới
          await api.put(`/api/events/${tempCreatedEventId}`, payload);
          newEventId = tempCreatedEventId;
        } else {
          // Chưa có event nào → tạo mới
          const eventRes = await api.post('/api/events', payload);
          newEventId = eventRes.data.id;
        }
        // Tạo vé (xoá cũ nếu draft đã có vé tạm)
        try {
          const existingTickets = await api.get(`/api/tickets/${newEventId}`);
          for (const t of existingTickets.data) {
            await api.delete(`/api/tickets/${t.id}`).catch(() => {});
          }
        } catch { /* ignore */ }
        for (const ticket of ticketRows) {
          if (!ticket.type) continue;
          await api.post('/api/tickets', {
            event_id: newEventId, type: ticket.type,
            price: parseCurrency(ticket.price),
            quantity_available: parseInt(ticket.quantity_available) || 0,
            max_per_order: parseInt(ticket.max_per_order) || 10,
          });
        }
        // Generate seatmap if configured
        if (hasSeatMap && seatmapConfig.rows && seatmapConfig.cols) {
          try {
            await api.post(`/api/events/${newEventId}/generate-seatmap`, {
              rows: seatmapConfig.rows,
              cols: seatmapConfig.cols,
            });
          } catch { /* seatmap not mandatory */ }
        }
        alert("Tạo sự kiện thành công!");
      }
      fetchEvents();
      resetWizard();
      setActiveTab('events_list');
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.msg || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa sự kiện này?")) return;
    try {
      await api.delete(`/api/events/${id}`);
      alert("Đã xóa!");
      fetchEvents();
      fetchPendingEvents();
    } catch (err) { alert("Lỗi khi xóa!"); }
  };

  const handleApproveEvent = async (id) => {
    try {
      await api.put(`/api/admin/events/${id}/approve`);
      alert("Sự kiện đã được duyệt!");
      fetchPendingEvents();
      fetchEvents();
      fetchStats();
    } catch (err) { alert("Lỗi: " + (err.response?.data?.msg || err.message)); }
  };

  const handleRejectEvent = async (id) => {
    if (!window.confirm("Từ chối sự kiện này?")) return;
    try {
      await api.put(`/api/admin/events/${id}/reject`);
      alert("Đã từ chối sự kiện.");
      fetchPendingEvents();
      fetchEvents();
    } catch (err) { alert("Lỗi!"); }
  };

  const handleApproveRequest = async (id) => {
    try {
      await api.put(`/api/admin/organizer-requests/${id}/approve`);
      alert("Đã cấp quyền Organizer!");
      fetchOrganizerRequests();
      fetchUsers();
      fetchStats();
    } catch (err) { alert("Lỗi: " + (err.response?.data?.msg || err.message)); }
  };

  const handleRejectRequest = async (id) => {
    if (!window.confirm("Từ chối yêu cầu này?")) return;
    try {
      await api.put(`/api/admin/organizer-requests/${id}/reject`);
      alert("Đã từ chối.");
      fetchOrganizerRequests();
    } catch (err) { alert("Lỗi!"); }
  };

  const StatusBadge = ({ status }) => {
    const map = {
      published: { bg: '#2CC27520', color: '#2CC275', text: 'Đã duyệt' },
      pending: { bg: '#FFC10720', color: '#FFC107', text: 'Chờ duyệt' },
      rejected: { bg: '#ff4d4f20', color: '#ff4d4f', text: 'Từ chối' },
      approved: { bg: '#2CC27520', color: '#2CC275', text: 'Đã duyệt' },
    };
    const s = map[status] || map.pending;
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', border: `1px solid ${s.color}30` }}>{s.text}</span>;
  };

  const RoleBadge = ({ role }) => {
    const map = {
      admin: { bg: '#ff4d4f20', color: '#ff4d4f' },
      organizer: { bg: '#1890ff20', color: '#1890ff' },
      customer: { bg: '#66666620', color: '#999' },
    };
    const s = map[role] || map.customer;
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{role}</span>;
  };

  const tabs = [
    { id: 'revenue', label: 'Dòng tiền', icon: <FaChartLine /> },
    { id: 'analytics', label: 'Phân tích chi tiết', icon: <FaChartBar /> },
    { id: 'events_list', label: 'Danh sách SK', icon: <FaList /> },
    { id: 'events_create', label: 'Thêm sự kiện', icon: <FaCalendarPlus /> },
    { id: 'pending', label: 'Chờ duyệt', icon: <FaStar />, badge: pendingEvents.length },
    { id: 'requests', label: 'Đối tác', icon: <FaHandshake />, badge: organizerRequests.filter(r => r.status === 'pending').length },
    { id: 'users', label: 'Users', icon: <FaUsers /> },
  ];

  const chartData = {
    labels: revenueChartData.map(d => new Date(d.date).toLocaleDateString('vi-VN')),
    datasets: [
      {
        label: 'Doanh thu ròng (Platform Fee)',
        data: revenueChartData.map(d => parseFloat(d.platform_fee)),
        borderColor: '#2CC275',
        backgroundColor: 'rgba(44, 194, 117, 0.2)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Tổng GMV',
        data: revenueChartData.map(d => parseFloat(d.total_price)),
        borderColor: '#1890ff',
        backgroundColor: 'rgba(24, 144, 255, 0.2)',
        tension: 0.4,
        borderDash: [5, 5],
      }
    ]
  };

  // Filtered Events
  const filteredEvents = events.filter(ev => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || ev.title?.toLowerCase().includes(q) || ev.location?.toLowerCase().includes(q) || ev.creator_email?.toLowerCase().includes(q) || ev.organizer?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || ev.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Wizard Step Navigation Validation
  const canProceedStep1 = eventData.title && eventData.location && eventData.organizer && eventData.event_date && eventData.image_url;
  const canProceedStep2 = ticketRows.length > 0 && ticketRows.every(t => t.type && t.price);

  return (
    <div className="container" style={{ padding: '40px 20px', color: '#eee', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .wizard-step { animation: slideIn 0.25s ease; }
        .events-table tr:hover { background: #1e1e1e !important; }
      `}</style>

      {/* Event Detail Modal */}
      {viewingEvent && (
        <EventDetailModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
          onEdit={(ev) => { handleEditClick(ev); setViewingEvent(null); }}
          onApprove={(id) => { handleApproveEvent(id); setViewingEvent(null); }}
          onReject={(id) => { handleRejectEvent(id); setViewingEvent(null); }}
          onDelete={(id) => { handleDelete(id); setViewingEvent(null); }}
        />
      )}

      <h1 style={{ color: '#2CC275', textAlign: 'center', marginBottom: '16px', fontSize: '32px' }}>Quản Trị Hệ Thống</h1>

      {/* Stats Overview */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '30px' }}>
          {[
            { label: 'Events', value: stats.total_events, color: '#2CC275' },
            { label: 'Users', value: stats.total_users, color: '#1890ff' },
            { label: 'Đơn hàng', value: stats.total_orders, color: '#FFC107' },
            { label: 'Doanh thu', value: new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(stats.total_revenue) + 'đ', color: '#ff6b6b' },
            { label: 'Hoa hồng (Net)', value: new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(stats.platform_fee) + 'đ', color: '#2CC275' },
            { label: 'Chờ duyệt', value: stats.pending_events, color: '#FFC107' },
            { label: 'YC Đối tác', value: stats.pending_requests, color: '#1890ff' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#1e1e1e', padding: '12px', borderRadius: '10px', border: '1px solid #333', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px', fontWeight: '600' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '30px', flexWrap: 'wrap', borderBottom: '2px solid #333', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 20px', border: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: '600', borderRadius: '8px 8px 0 0',
              background: activeTab === tab.id ? '#1e1e1e' : 'transparent',
              color: activeTab === tab.id ? '#2CC275' : '#888',
              borderBottom: activeTab === tab.id ? '2px solid #2CC275' : '2px solid transparent',
              transition: 'all 0.2s', position: 'relative',
            }}
          >
            {tab.icon} {tab.label}
            {tab.badge > 0 && (
              <span style={{
                background: '#ff4d4f', color: 'white', borderRadius: '10px',
                padding: '1px 7px', fontSize: '11px', fontWeight: '700', minWidth: '18px', textAlign: 'center'
              }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'revenue' && (() => {
        const fmtK = (n) => { const v = parseFloat(n)||0; if(v>=1e9) return (v/1e9).toFixed(1)+'tỷ'; if(v>=1e6) return (v/1e6).toFixed(1)+'tr'; return v.toLocaleString('vi-VN'); };
        const fmt = (n) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n||0);
        const TrendBadge = ({pct}) => pct === undefined ? null : (
          <span style={{fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:8,
            background: pct>=0 ? '#2CC27520' : '#ff4d4f20',
            color: pct>=0 ? '#2CC275' : '#ff4d4f'}}>
            {pct>=0?'↑':'↓'} {Math.abs(pct)}% 30 ngày trước
          </span>
        );
        const t = platformSummary?.trend;
        return (
        <div style={{padding:'24px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28,flexWrap:'wrap',gap:12}}>
            <h2 style={{color:'#2CC275',margin:0,fontSize:22,fontWeight:800}}>Thống Kê Dòng Tiền & Doanh Thu</h2>
            <div style={{background:'#252525',padding:'6px 12px',borderRadius:8,border:'1px solid #444',display:'flex',alignItems:'center',gap:8}}>
              <FaFilter color="#888" size={12}/>
              <select value={dateRange} onChange={e=>setDateRange(e.target.value)} style={{background:'transparent',color:'#fff',border:'none',outline:'none',fontSize:13,cursor:'pointer'}}>
                <option value="all">Toàn thời gian</option>
                <option value="30days">30 ngày qua</option>
                <option value="7days">7 ngày qua</option>
              </select>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginBottom:32}}>
            {[{
              label:'GMV (Tổng Tiền Giữ Hộ)', value: fmtK(stats?.total_revenue)+'đ',
              sub: fmt(stats?.total_revenue), color:'#1890ff', pct: t?.gmv_pct
            },{
              label:'Phí Nền Tảng (3.5%)', value: fmtK(stats?.platform_fee)+'đ',
              sub: fmt(stats?.platform_fee), color:'#2CC275', pct: t?.fee_pct
            },{ 
              label:'Thanh Toán Đối Soát', value: fmtK(stats?.net_revenue)+'đ',
              sub: fmt(stats?.net_revenue), color:'#ff4d4f', pct: t?.gmv_pct != null ? -(t?.gmv_pct||0) : undefined
            }].map((c,i) => (
              <div key={i} style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,
                padding:'18px 20px',borderLeft:`4px solid ${c.color}`}}>
                <div style={{fontSize:11,color:'#666',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>{c.label}</div>
                <div style={{fontSize:26,fontWeight:800,color:'#fff',lineHeight:1.1,marginBottom:6}}>{c.value}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'#555'}}>{c.sub}</span>
                  <TrendBadge pct={c.pct} />
                </div>
              </div>
            ))}
          </div>

          <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,padding:24,marginBottom:32}}>
            <h3 style={{color:'#fff',margin:'0 0 20px 0',fontSize:15,fontWeight:700}}>Biểu Đồ Tăng Trưởng GMV</h3>
            <div style={{height:340}}>
              <Line data={chartData} options={{
                maintainAspectRatio:false,
                plugins:{legend:{labels:{color:'#ccc',font:{size:13}}},tooltip:{callbacks:{label:(ctx)=>fmt(ctx.raw)}}},
                scales:{x:{ticks:{color:'#666'},grid:{color:'#1a1a1a'}},y:{ticks:{color:'#666',callback:v=>fmtK(v)+'đ'},grid:{color:'#222'}}}
              }}/>
            </div>
          </div>

          <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #2a2a2a',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{color:'#fff',margin:0,fontSize:15,fontWeight:700}}>Doanh Thu Theo Sự Kiện <span style={{color:'#555',fontSize:12,fontWeight:400}}>(click để xem chi tiết đơn hàng)</span></h3>
              <button onClick={()=>exportToCSV(revenueEventsData,'DoanhThu_SuKien')} style={{background:'#1890ff',color:'white',border:'none',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                <FaDownload/> CSV
              </button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#161616',color:'#555',textTransform:'uppercase',fontSize:11}}>
                    {['#','Sự Kiện','SL Bán','Tổng GMV','Phí NT (3.5%)','Đối Soát'].map(h=>(
                      <th key={h} style={{padding:'11px 16px',textAlign:h==='Sự Kiện'||h===' #'?'left':'right',borderBottom:'1px solid #222'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revenueEventsData.length > 0 ? revenueEventsData.map((ev,idx) => (
                    <tr key={ev.event_id}
                      style={{borderBottom:'1px solid #161616',cursor:'pointer',transition:'background .15s', opacity: parseFloat(ev.total_gmv) === 0 ? 0.45 : 1}}
                      onMouseEnter={e=>e.currentTarget.style.background='#1a1a1a'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}
                      onClick={()=>{setDrillEvent(ev);fetchDrillOrders(ev.event_id);}}
                    >
                      <td style={{padding:'13px 16px',color:'#444',fontSize:12,fontWeight:700}}>#{idx+1}</td>
                      <td style={{padding:'13px 16px',color: parseFloat(ev.total_gmv) === 0 ? '#555' : '#1890ff',fontWeight:700,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.event_title}</td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#2CC275',fontWeight:700}}>{ev.total_tickets_sold}</td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#fff',fontWeight:600}}>{fmt(ev.total_gmv)}</td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#2CC275'}}>{fmt(ev.platform_fee)}</td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#ff4d4f'}}>{fmt(ev.net_revenue)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{padding:32,textAlign:'center',color:'#444'}}>Chưa có giao dịch</td></tr>
                  )}
                </tbody>
                {revenueEventsData.length > 0 && (
                  <tfoot style={{background:'#111',borderTop:'1px solid #333'}}>
                    <tr>
                      <td colSpan={2} style={{padding:'11px 16px',color:'#888',fontSize:12,fontWeight:700}}>TỔNG ({revenueEventsData.length} sự kiện)</td>
                      <td style={{padding:'11px 16px',textAlign:'right',color:'#2CC275',fontWeight:800}}>{revenueEventsData.reduce((s,e)=>s+parseInt(e.total_tickets_sold),0)}</td>
                      <td style={{padding:'11px 16px',textAlign:'right',color:'#fff',fontWeight:800}}>{fmt(revenueEventsData.reduce((s,e)=>s+parseFloat(e.total_gmv),0))}</td>
                      <td style={{padding:'11px 16px',textAlign:'right',color:'#2CC275',fontWeight:800}}>{fmt(revenueEventsData.reduce((s,e)=>s+parseFloat(e.platform_fee),0))}</td>
                      <td style={{padding:'11px 16px',textAlign:'right',color:'#ff4d4f',fontWeight:800}}>{fmt(revenueEventsData.reduce((s,e)=>s+parseFloat(e.net_revenue),0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      );
      })()}

      {/* ── Admin Drill-down Modal ─────────────────────── */}
      {drillEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div style={{ background: '#1a1a1a', width: '100%', maxWidth: 900, maxHeight: '90vh', borderRadius: 16, border: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#2CC275', fontWeight: 700, fontSize: 16 }}>Chi Tiết Đơn Hàng</div>
                <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>{drillEvent.event_title}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportDrillCSV} style={{ background: '#1890ff', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FaDownload /> Xuất CSV
                </button>
                <button onClick={() => { setDrillEvent(null); setDrillOrders([]); setDrillSearch(''); setDrillTicketFilter('all'); }} style={{ background: '#333', color: '#aaa', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>&#x2715;</button>
              </div>
            </div>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={drillSearch}
                onChange={e => setDrillSearch(e.target.value)}
                placeholder="Tìm email, tên, mã đơn..."
                style={{ width: '100%', background: '#252525', border: '1px solid #333', borderRadius: 8, padding: '8px 14px', color: '#ccc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              {!drillLoading && drillOrders.length > 0 && (() => {
                const types = ['all', ...Array.from(new Set(drillOrders.map(o => o.ticket_type))).sort()];
                return (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginRight: 4 }}>Lọc hạng vé:</span>
                    {types.map(type => {
                      const count = type === 'all' ? drillOrders.length : drillOrders.filter(o => o.ticket_type === type).length;
                      const isActive = drillTicketFilter === type;
                      return (
                        <button key={type} onClick={() => setDrillTicketFilter(type)} style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: isActive ? 'none' : '1px solid #333',
                          background: isActive ? '#2CC275' : '#252525',
                          color: isActive ? '#000' : '#aaa', transition: 'all .15s'
                        }}>
                          {type === 'all' ? 'Tất cả' : type}
                          <span style={{ marginLeft: 5, opacity: .7, fontWeight: 400 }}>({count})</span>
                        </button>
                      );
                    })}
                    {drillTicketFilter !== 'all' && (
                      <button onClick={() => setDrillTicketFilter('all')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: 'transparent', border: '1px solid #444', color: '#666' }}>
                        ✕ Xóa lọc
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {drillLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Đang tải...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#111' }}>
                    <tr style={{ color: '#555', textTransform: 'uppercase', fontSize: 11 }}>
                      {['Mã đơn', 'Khách hàng', 'Loại vé', 'SL', 'Thành tiền', 'Phí NT', 'Ngày mua'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: ['SL', 'Thành tiền', 'Phí NT'].includes(h) ? 'right' : 'left', borderBottom: '1px solid #222' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = drillOrders.filter(o => {
                        const q = drillSearch.toLowerCase();
                        const matchText = !q || o.customer_email?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || o.order_code?.toLowerCase().includes(q);
                        const matchType = drillTicketFilter === 'all' || o.ticket_type === drillTicketFilter;
                        return matchText && matchType;
                      });
                      return (
                        <>
                          {filtered.map((o, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #161616' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}
                            >
                              <td style={{ padding: '11px 14px', color: '#1890ff', fontFamily: 'monospace', fontSize: 12 }}>{o.order_code}</td>
                              <td style={{ padding: '11px 14px' }}>
                                <div style={{ color: '#fff', fontWeight: 600 }}>{o.customer_name || '—'}</div>
                                <div style={{ color: '#555', fontSize: 11 }}>{o.customer_email}</div>
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <span style={{ background: '#2CC27520', color: '#2CC275', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{o.ticket_type}</span>
                              </td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', color: '#FFC107', fontWeight: 700 }}>{o.quantity_ordered}</td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', color: '#2CC275', fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(o.subtotal)}</td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', color: '#aaa' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(o.platform_fee)}</td>
                              <td style={{ padding: '11px 14px', color: '#555', fontSize: 11 }}>{new Date(o.purchased_at).toLocaleString('vi-VN')}</td>
                            </tr>
                          ))}
                          {filtered.length === 0 && !drillLoading && (
                            <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#555' }}>Không tìm thấy đơn hàng nào</td></tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                  <tfoot style={{ background: '#111', borderTop: '1px solid #333' }}>
                    {(() => {
                      const filtered = drillOrders.filter(o => {
                        const q = drillSearch.toLowerCase();
                        const matchText = !q || o.customer_email?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || o.order_code?.toLowerCase().includes(q);
                        const matchType = drillTicketFilter === 'all' || o.ticket_type === drillTicketFilter;
                        return matchText && matchType;
                      });
                      const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
                      return (
                        <tr>
                          <td colSpan={3} style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                            TỔNG ({filtered.length}/{drillOrders.length} đơn)
                            {drillTicketFilter !== 'all' && <span style={{ color: '#2CC275', marginLeft: 6 }}>· {drillTicketFilter}</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#FFC107', fontWeight: 700 }}>{filtered.reduce((s, o) => s + parseInt(o.quantity_ordered), 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#2CC275', fontWeight: 700 }}>{fmt(filtered.reduce((s, o) => s + parseFloat(o.subtotal), 0))}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#aaa' }}>{fmt(filtered.reduce((s, o) => s + parseFloat(o.platform_fee), 0))}</td>
                          <td />
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (() => {
        const fmt = (n) => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n||0);
        const fmtK = (n) => { const v=parseFloat(n)||0; if(v>=1e9) return (v/1e9).toFixed(1)+'tỷ'; if(v>=1e6) return (v/1e6).toFixed(1)+'tr'; return v.toLocaleString('vi-VN'); };
        const COLORS = ['#2CC275','#1890ff','#FFC107','#ff4d4f','#722ed1','#eb2f96','#13c2c2','#fa8c16'];
        const totalCategoryGMV = revenueByCategory.reduce((s,c)=>s+parseFloat(c.total_gmv||0),0);
        return (
        <div style={{padding:'24px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28,flexWrap:'wrap',gap:12}}>
            <h2 style={{color:'#2CC275',margin:0,fontSize:22,fontWeight:800,display:'flex',alignItems:'center',gap:10}}>
              <FaChartBar/> Phân Tích Sâu Nền Tảng
            </h2>
            <button onClick={()=>exportToCSV(revenueDetailed,'DoanhThu_ChiTiet')} style={{background:'#1890ff',color:'white',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13}}>
              <FaDownload/> Xuất CSV
            </button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:32}}>
            <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,padding:24}}>
              <h3 style={{color:'#fff',margin:'0 0 20px 0',fontSize:15,fontWeight:700}}>Doanh Thu Theo Thể Loại</h3>
              {revenueByCategory.filter(c=>parseFloat(c.total_gmv)>0).map((c,i) => {
                const pct = totalCategoryGMV>0 ? Math.round((parseFloat(c.total_gmv)/totalCategoryGMV)*100) : 0;
                return (
                  <div key={c.category_id} style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:13}}>
                      <span style={{color:'#ccc',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:10,height:10,borderRadius:3,background:COLORS[i%COLORS.length],display:'inline-block'}}/>
                        {c.category_name}
                        <span style={{color:'#555',fontSize:11}}>({c.total_events} SK, {c.tickets_sold} vé)</span>
                      </span>
                      <span style={{color:COLORS[i%COLORS.length],fontWeight:700}}>{pct}%</span>
                    </div>
                    <div style={{background:'#2a2a2a',borderRadius:6,height:8,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:COLORS[i%COLORS.length],borderRadius:6,transition:'width .6s ease'}}/>
                    </div>
                    <div style={{textAlign:'right',fontSize:11,color:'#555',marginTop:3}}>{fmtK(c.total_gmv)}đ GMV · {fmtK(c.platform_fee)}đ phí</div>
                  </div>
                );
              })}
              {revenueByCategory.filter(c=>parseFloat(c.total_gmv)>0).length===0 && (
                <div style={{textAlign:'center',padding:40,color:'#444'}}>Chưa có dữ liệu</div>
              )}
            </div>

            <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,padding:24}}>
              <h3 style={{color:'#fff',margin:'0 0 20px 0',fontSize:15,fontWeight:700}}>Giờ Cao Điểm Mua Vé</h3>
              <div style={{height:280}}>
                <Bar
                  data={{
                    labels: revenueByHour.map(h=>h.hour_label),
                    datasets:[{
                      label:'Doanh Thu',
                      data: revenueByHour.map(h=>parseFloat(h.total_revenue)),
                      backgroundColor: revenueByHour.map(h=>{
                        const v=parseFloat(h.total_revenue); const max=Math.max(...revenueByHour.map(x=>parseFloat(x.total_revenue)));
                        return v===max?'#2CC275':'rgba(44,194,117,0.35)';
                      }),
                      borderRadius:5,borderSkipped:false
                    }]
                  }}
                  options={{
                    maintainAspectRatio:false,
                    plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>fmt(ctx.raw)}}},
                    scales:{x:{ticks:{color:'#666'},grid:{display:false}},y:{ticks:{color:'#666',callback:v=>fmtK(v)+'đ'},grid:{color:'#1e1e1e'}}}
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:32}}>
            <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,padding:24}}>
              <h3 style={{color:'#fff',margin:'0 0 20px 0',fontSize:15,fontWeight:700}}>Phương Thức Thanh Toán</h3>
              {paymentMethods.length > 0 ? (
                <div style={{display:'flex',alignItems:'center',gap:24}}>
                  <div style={{width:180,height:180}}>
                    <Doughnut
                      data={{
                        labels: paymentMethods.map(p => { const labels = {vnpay:'VNPay',unknown:'Khác'}; return labels[p.method] || p.method; }),
                        datasets:[{ data: paymentMethods.map(p => parseFloat(p.total_revenue)), backgroundColor: ['#2CC275','#d82d8b','#1890ff','#FFC107','#ff4d4f'], borderWidth: 0 }]
                      }}
                      options={{ cutout:'65%', plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>fmt(ctx.raw)}}} }}
                    />
                  </div>
                  <div style={{flex:1}}>
                    {paymentMethods.map((p,i) => {
                      const labels = {vnpay:'VNPay',unknown:'Khác'};
                      const colors = ['#2CC275','#d82d8b','#1890ff','#FFC107','#ff4d4f'];
                      const totalRev = paymentMethods.reduce((s,x)=>s+parseFloat(x.total_revenue),0);
                      const pct = totalRev > 0 ? Math.round((parseFloat(p.total_revenue)/totalRev)*100) : 0;
                      return (
                        <div key={p.method} style={{marginBottom:12}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                            <span style={{color:'#ccc',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                              <span style={{width:10,height:10,borderRadius:3,background:colors[i%colors.length],display:'inline-block'}}/>
                              {labels[p.method] || p.method}
                            </span>
                            <span style={{color:'#fff',fontSize:13,fontWeight:700}}>{pct}%</span>
                          </div>
                          <div style={{color:'#555',fontSize:11}}>{p.total_orders} đơn · {fmtK(p.total_revenue)}đ</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{textAlign:'center',padding:40,color:'#444'}}>Chưa có dữ liệu</div>
              )}
            </div>

            <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,padding:24,display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <h3 style={{color:'#fff',margin:'0 0 20px 0',fontSize:15,fontWeight:700}}>Tổng Vé Đã Bán</h3>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:48,fontWeight:800,color:'#2CC275',lineHeight:1.1}}>
                  {(ticketsSoldStats?.total_tickets_sold || stats?.total_tickets_sold || 0).toLocaleString('vi-VN')}
                </div>
                <div style={{color:'#666',fontSize:14,marginTop:8}}>vé đã bán thành công</div>
              </div>
              <div style={{marginTop:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{background:'#161616',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:700,color:'#1890ff'}}>{stats?.total_orders || 0}</div>
                  <div style={{fontSize:11,color:'#555',marginTop:4}}>Đơn hàng</div>
                </div>
                <div style={{background:'#161616',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:700,color:'#FFC107'}}>{stats?.total_events || 0}</div>
                  <div style={{fontSize:11,color:'#555',marginTop:4}}>Sự kiện</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,overflow:'hidden',marginBottom:32}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #2a2a2a'}}>
              <h3 style={{color:'#fff',margin:0,fontSize:15,fontWeight:700}}>Xếp Hạng Nhà Tổ Chức (Top 10)</h3>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#161616',color:'#555',textTransform:'uppercase',fontSize:11}}>
                    {['Hạng','Nhà Tổ Chức','Sự Kiện','Vé Bán','Tổng GMV','Thanh Toán (96.5%)'].map(h=>(
                      <th key={h} style={{padding:'11px 16px',textAlign:['Sự Kiện','Vé Bán','Tổng GMV','Thanh Toán (96.5%)'].includes(h)?'right':'left',borderBottom:'1px solid #222'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topOrganizers.length>0 ? topOrganizers.map((org,i)=>(
                    <tr key={org.organizer_id} style={{borderBottom:'1px solid #161616'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#1a1a1a'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}
                    >
                      <td style={{padding:'13px 16px'}}>
                        <span style={{fontWeight:800,fontSize:16,color:i===0?'#FFC107':i===1?'#aaa':i===2?'#cd7f32':'#555'}}>#{i+1}</span>
                      </td>
                      <td style={{padding:'13px 16px'}}>
                        <div style={{color:'#fff',fontWeight:700}}>{org.org_name}</div>
                        <div style={{color:'#555',fontSize:11}}>{org.organizer_email}</div>
                      </td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#aaa'}}>
                        <span style={{color:'#2CC275',fontWeight:700}}>{org.published_events}</span>
                        <span style={{color:'#444',fontSize:11}}> / {org.total_events}</span>
                      </td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#FFC107',fontWeight:700}}>{org.tickets_sold}</td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#fff',fontWeight:600}}>{fmt(org.total_gmv)}</td>
                      <td style={{padding:'13px 16px',textAlign:'right',color:'#2CC275',fontWeight:700}}>{fmt(org.organizer_revenue)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{padding:32,textAlign:'center',color:'#444'}}>Chưa có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{background:'#1e1e1e',border:'1px solid #2a2a2a',borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #2a2a2a'}}>
              <h3 style={{color:'#fff',margin:0,fontSize:15,fontWeight:700}}>Chi Tiết Doanh Thu Từng Sự Kiện (Đầy Đủ)</h3>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#161616',color:'#555',textTransform:'uppercase',fontSize:11}}>
                    {['Sự Kiện','Ngày Diễn','Đơn Hàng','Vé Bán','Doanh Thu','Lợi Nhuận Net','Giá TB'].map(h=>(
                      <th key={h} style={{padding:'11px 14px',textAlign:['Đơn Hàng','Vé Bán','Doanh Thu','Lợi Nhuận Net','Giá TB'].includes(h)?'right':'left',borderBottom:'1px solid #222'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revenueDetailed.length>0 ? revenueDetailed.map(ev=>(
                    <tr key={ev.event_id} style={{borderBottom:'1px solid #161616'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#1a1a1a'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}
                    >
                      <td style={{padding:'12px 14px',color:'#fff',fontWeight:600,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.event_title}</td>
                      <td style={{padding:'12px 14px',color:'#555',fontSize:12}}>{new Date(ev.event_date).toLocaleDateString('vi-VN')}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',color:'#1890ff',fontWeight:700}}>{ev.total_orders}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',color:'#2CC275',fontWeight:700}}>{ev.total_tickets_sold}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',color:'#fff'}}>{fmt(ev.total_revenue)}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',color:'#2CC275',fontWeight:700}}>{fmt(ev.net_revenue)}</td>
                      <td style={{padding:'12px 14px',textAlign:'right',color:'#FFC107'}}>{fmt(ev.avg_ticket_price)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} style={{padding:32,textAlign:'center',color:'#444'}}>Chưa có dữ liệu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
      })()}

      {activeTab === 'events_list' && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaList style={{ color: '#2CC275' }} /> Danh Sách Sự Kiện
                <span style={{ background: '#2CC27520', color: '#2CC275', padding: '3px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: '700' }}>
                  {filteredEvents.length}
                </span>
              </h2>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>Quản lý toàn bộ sự kiện trên nền tảng</p>
            </div>
            <button
              onClick={() => { resetWizard(); setActiveTab('events_create'); }}
              style={{
                background: 'linear-gradient(135deg, #2CC275, #1da562)',
                color: 'white', border: 'none', padding: '12px 24px',
                borderRadius: '10px', cursor: 'pointer', fontWeight: '700',
                fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 15px rgba(44,194,117,0.3)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(44,194,117,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(44,194,117,0.3)'; }}
            >
              <FaPlus /> Thêm sự kiện
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '13px' }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên, địa điểm, người tổ chức..."
                style={{
                  width: '100%', background: '#1e1e1e', border: '1px solid #333',
                  borderRadius: '10px', padding: '11px 14px 11px 40px', color: '#fff',
                  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#2CC275'}
                onBlur={e => e.target.style.borderColor = '#333'}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { key: 'all', label: 'Tất cả', color: '#888' },
                { key: 'published', label: 'Đã duyệt', color: '#2CC275' },
                { key: 'pending', label: 'Chờ duyệt', color: '#FFC107' },
                { key: 'rejected', label: 'Từ chối', color: '#ff4d4f' },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontWeight: '600', fontSize: '13px', transition: 'all 0.15s',
                  background: statusFilter === f.key ? f.color : '#1e1e1e',
                  color: statusFilter === f.key ? '#fff' : f.color,
                  boxShadow: statusFilter === f.key ? `0 2px 8px ${f.color}40` : 'none',
                  borderColor: statusFilter === f.key ? f.color : '#2a2a2a',
                }}>
                  {f.label}
                </button>
              ))}
            </div>

          </div>

          {/* Events Table */}
          <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
            <table className="events-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#141414', color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ ...thStyle, width: '60px' }}>ID</th>
                  <th style={thStyle}>Sự kiện</th>
                  <th style={{ ...thStyle, width: '160px' }}>Người tạo</th>
                  <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Nổi bật</th>
                  <th style={{ ...thStyle, width: '140px', textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? filteredEvents.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #1f1f1f', transition: 'background 0.12s' }}>
                    <td style={{ ...tdStyle, color: '#444', fontSize: '12px', fontWeight: '700' }}>#{ev.id}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img
                          src={ev.image_url}
                          alt=""
                          style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid #2a2a2a' }}
                          onError={e => e.target.src = 'https://via.placeholder.com/54'}
                        />
                        <div>
                          <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px', marginBottom: '3px' }}>{ev.title}</div>
                          <div style={{ fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FaMapMarkerAlt size={10} /> {ev.location}
                          </div>
                          {ev.event_date && (
                            <div style={{ fontSize: '11px', color: '#444', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FaClock size={9} /> {new Date(ev.event_date).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '13px', color: '#aaa' }}>{ev.creator_email}</div>
                      {ev.organizer && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{ev.organizer}</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <StatusBadge status={ev.status} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {ev.is_featured
                        ? <FaStar style={{ color: 'gold', fontSize: '16px' }} />
                        : <span style={{ color: '#333', fontSize: '12px' }}>—</span>
                      }
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <ActionDropdown
                        event={ev}
                        onView={setViewingEvent}
                        onApprove={handleApproveEvent}
                        onReject={handleRejectEvent}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div style={{ color: '#444', fontSize: '16px', fontWeight: '600' }}>Không tìm thấy sự kiện nào</div>
                      <div style={{ color: '#333', fontSize: '13px', marginTop: '8px' }}>Thử thay đổi điều kiện tìm kiếm</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'events_create' && (
        <div className="wizard-step">
          {/* Wizard Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCalendarPlus style={{ color: '#2CC275' }} />
                {editingId ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}
              </h2>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>
                {editingId ? `Đang chỉnh sửa ID #${editingId}` : 'Hoàn thành các bước để tạo sự kiện'}
              </p>
            </div>
            <button
              onClick={() => { resetWizard(); setActiveTab('events_list'); }}
              style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}
            >
              <FaArrowLeft size={12} /> Quay lại danh sách
            </button>
          </div>

          {/* Step Indicator — dùng cả khi edit */}
          <StepIndicator current={wizardStep} onStepClick={setWizardStep} />

          {/* Draft indicator — chỉ khi tạo mới */}
          {!editingId && (draftSavedAt || draftSaving) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                {draftSaving ? (
                  <><span style={{ color: '#555' }}>⟳</span><span style={{ color: '#555' }}>Đang lưu nháp...</span></>
                ) : (
                  <><span style={{ color: '#2CC275' }}>✓</span><span style={{ color: '#666' }}>Đã lưu nháp lúc <strong style={{ color: '#888' }}>{draftSavedAt?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong></span></>
                )}
              </div>
              <button onClick={() => { clearDraft(); resetWizard(); }} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', fontSize: '11px', cursor: 'pointer', fontWeight: '600', padding: '2px 8px', borderRadius: '4px' }}>Xóa nháp</button>
            </div>
          )}

          {/* ─── Step 1: Basic Info ─── */}
          {wizardStep === 1 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '32px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #2a2a2a' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #2CC275, #1da562)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaFileAlt size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>Thông tin cơ bản</div>
                  <div style={{ color: '#555', fontSize: '12px' }}>Tên, địa điểm, hình ảnh và mô tả sự kiện</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={labelStyle}>Tên sự kiện <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input
                      style={inputStyle} required
                      value={eventData.title}
                      onChange={e => setEventData({ ...eventData, title: e.target.value })}
                      placeholder="Nhập tên sự kiện..."
                      onFocus={e => e.target.style.borderColor = '#2CC275'}
                      onBlur={e => e.target.style.borderColor = '#444'}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Thể loại <span style={{ color: '#ff4d4f' }}>*</span></label>
                    {!isAddingCategory ? (
                      <select style={selectStyle} value={eventData.category_id} onChange={handleCategoryChange}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="new_category_option" style={{ fontWeight: 'bold' }}>+ Thêm mới...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input style={inputStyle} autoFocus placeholder="Tên thể loại mới..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                        <button type="button" onClick={handleSaveNewCategory} style={{ background: '#2CC275', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer' }}><FaSave /></button>
                        <button type="button" onClick={() => setIsAddingCategory(false)} style={{ background: '#444', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer' }}><FaTimes /></button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Ban tổ chức <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input
                      style={inputStyle} required
                      value={eventData.organizer}
                      onChange={e => setEventData({ ...eventData, organizer: e.target.value })}
                      placeholder="Đơn vị tổ chức..."
                      onFocus={e => e.target.style.borderColor = '#2CC275'}
                      onBlur={e => e.target.style.borderColor = '#444'}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Địa điểm <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <input
                      style={inputStyle} required
                      value={eventData.location}
                      onChange={e => setEventData({ ...eventData, location: e.target.value })}
                      placeholder="Địa chỉ tổ chức..."
                      onFocus={e => e.target.style.borderColor = '#2CC275'}
                      onBlur={e => e.target.style.borderColor = '#444'}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Bắt đầu <span style={{ color: '#ff4d4f' }}>*</span></label>
                      <input type="datetime-local" style={inputStyle} required value={eventData.event_date} onChange={e => setEventData({ ...eventData, event_date: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Kết thúc</label>
                      <input type="datetime-local" style={inputStyle} value={eventData.end_date} onChange={e => setEventData({ ...eventData, end_date: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ background: '#252525', padding: '14px 16px', borderRadius: '10px', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox" id="is_featured"
                      checked={eventData.is_featured}
                      onChange={e => setEventData({ ...eventData, is_featured: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#2CC275', cursor: 'pointer' }}
                    />
                    <label htmlFor="is_featured" style={{ cursor: 'pointer', fontWeight: '600', color: eventData.is_featured ? '#FFC107' : '#aaa', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <FaStar style={{ color: eventData.is_featured ? '#FFC107' : '#555' }} /> Đánh dấu sự kiện nổi bật
                    </label>
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <ImageUploader
                    currentUrl={eventData.image_url
                      ? (eventData.image_url.startsWith('http')
                          ? eventData.image_url
                          : `http://localhost:5001${eventData.image_url}`)
                      : ''}
                    onUpload={url => setEventData({ ...eventData, image_url: url })}
                    label="Ảnh bìa sự kiện"
                    aspectRatio={16 / 9}
                    required
                    maxSizeMB={5}
                    minWidth={1200}
                    minHeight={630}
                  />

                  <div>
                    <label style={labelStyle}>Mô tả sự kiện <span style={{ color: '#ff4d4f' }}>*</span></label>
                    <RichEditor
                      value={eventData.description}
                      onChange={html => setEventData({ ...eventData, description: html })}
                      placeholder="Mô tả chi tiết về sự kiện — hỗ trợ in đậm, in nghiêng, danh sách, ảnh..."
                    />
                  </div>
                </div>
              </div>

              {/* Step 1 actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #2a2a2a' }}>
                <button
                  onClick={() => { if (canProceedStep1) setWizardStep(2); else alert('Vui lòng điền đầy đủ thông tin bắt buộc!'); }}
                  style={{
                    background: canProceedStep1 ? 'linear-gradient(135deg, #2CC275, #1da562)' : '#252525',
                    color: canProceedStep1 ? '#fff' : '#555',
                    border: 'none', padding: '14px 32px', borderRadius: '10px',
                    cursor: canProceedStep1 ? 'pointer' : 'not-allowed',
                    fontWeight: '700', fontSize: '15px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: canProceedStep1 ? '0 4px 15px rgba(44,194,117,0.3)' : 'none',
                  }}
                >
                  Tiếp theo <FaArrowRight />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Ticket Tiers ─────────────────────────────────────────── */}
          {wizardStep === 2 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '32px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #2a2a2a' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #2CC275, #1da562)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaTicketAlt size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>Thiết lập hạng vé</div>
                  <div style={{ color: '#555', fontSize: '12px' }}>Thêm các loại vé cho sự kiện</div>
                </div>
              </div>

              {/* Ticket rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr 1fr auto', gap: '12px', padding: '0 16px' }}>
                  {['Tên hạng vé', 'Giá (VNĐ)', 'Số lượng', 'Tối đa/đơn', ''].map(h => (
                    <span key={h} style={{ fontSize: '11px', color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
                  ))}
                </div>

                {ticketRows.map((ticket, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '3fr 2fr 2fr 1fr auto',
                    gap: '12px', alignItems: 'center',
                    background: '#252525', padding: '16px', borderRadius: '12px',
                    border: '1px solid #333',
                  }}>
                    <input
                      style={inputStyle} required value={ticket.type}
                      onChange={e => handleTicketChange(i, 'type', e.target.value)}
                      placeholder="VD: Vé VIP, Vé Thường..."
                      onFocus={e => e.target.style.borderColor = '#2CC275'}
                      onBlur={e => e.target.style.borderColor = '#444'}
                    />
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text" style={{ ...inputStyle, color: '#2CC275', fontWeight: '700', paddingRight: '40px' }}
                        required value={ticket.price} placeholder="0"
                        onChange={e => handleTicketChange(i, 'price', e.target.value)}
                        onFocus={e => e.target.style.borderColor = '#2CC275'}
                        onBlur={e => e.target.style.borderColor = '#444'}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '12px', fontWeight: '600' }}>đ</span>
                    </div>
                    <input
                      type="number" style={inputStyle} required value={ticket.quantity_available}
                      onChange={e => handleTicketChange(i, 'quantity_available', e.target.value)}
                      min={1}
                      onFocus={e => e.target.style.borderColor = '#2CC275'}
                      onBlur={e => e.target.style.borderColor = '#444'}
                    />
                    <input
                      type="number"
                      style={{ ...inputStyle, color: '#1890ff', textAlign: 'center' }}
                      title="Số lượng vé tối đa mỗi đơn hàng (không được vượt quá số lượng vé)"
                      value={ticket.max_per_order ?? 10}
                      onChange={e => handleTicketChange(i, 'max_per_order', parseInt(e.target.value) || 1)}
                      min={1} max={parseInt(ticket.quantity_available) || 999}
                      onFocus={e => e.target.style.borderColor = '#1890ff'}
                      onBlur={e => e.target.style.borderColor = '#444'}
                    />
                    {ticketRows.length > 1 ? (
                      <button type="button" onClick={() => {
                        const removed = ticketRows[i];
                        if (removed.id) setDeletedTicketIds(prev => [...prev, removed.id]);
                        setTicketRows(ticketRows.filter((_, idx) => idx !== i));
                      }}
                        style={{ background: '#ff4d4f20', border: '1px solid #ff4d4f50', color: '#ff4d4f', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaTrash size={12} />
                      </button>
                    ) : <div />}
                  </div>
                ))}
              </div>

              <button type="button"
                onClick={() => setTicketRows([...ticketRows, { type: '', price: '', quantity_available: 100, max_per_order: 10 }])}
                style={{ background: 'transparent', color: '#2CC275', border: '1px dashed #2CC275', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaPlus /> Thêm hạng vé
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #2a2a2a' }}>
                <button onClick={() => setWizardStep(1)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaArrowLeft size={12} /> Quay lại
                </button>
                <button onClick={() => { if (canProceedStep2) setWizardStep(3); else alert('Vui lòng điền đầy đủ tên và giá cho tất cả hạng vé!'); }}
                  style={{
                    background: canProceedStep2 ? 'linear-gradient(135deg, #2CC275, #1da562)' : '#252525',
                    color: canProceedStep2 ? '#fff' : '#555',
                    border: 'none', padding: '12px 28px', borderRadius: '10px',
                    cursor: canProceedStep2 ? 'pointer' : 'not-allowed',
                    fontWeight: '700', fontSize: '14px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: canProceedStep2 ? '0 4px 15px rgba(44,194,117,0.3)' : 'none',
                  }}>
                  Tiếp theo <FaArrowRight />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Seat Map ─────────────────────────────────────────────── */}
          {wizardStep === 3 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '32px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #2a2a2a' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #2CC275, #1da562)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaMapMarked size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>Thiết lập sơ đồ chỗ ngồi</div>
                  <div style={{ color: '#555', fontSize: '12px' }}>Tùy chọn — cấu hình sơ đồ ghế ngồi nếu có</div>
                </div>
              </div>

              {/* Toggle: có/không sơ đồ */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '28px' }}>
                {[
                  { value: false, label: 'Không có sơ đồ', desc: 'Vé không có chỗ ngồi cụ thể', icon: <FaTicketAlt size={20} /> },
                  { value: true, label: 'Có sơ đồ chỗ ngồi', desc: 'Người mua chọn ghế khi đặt vé', icon: <FaMapMarked size={20} /> },
                ].map(opt => (
                  <div
                    key={String(opt.value)}
                    onClick={() => { setHasSeatMap(opt.value); setSeatmapDone(false); }}
                    style={{
                      flex: 1, padding: '24px', borderRadius: '14px', cursor: 'pointer',
                      border: hasSeatMap === opt.value ? '2px solid #2CC275' : '2px solid #2a2a2a',
                      background: hasSeatMap === opt.value ? '#2CC27510' : '#252525',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ color: hasSeatMap === opt.value ? '#2CC275' : '#555', marginBottom: '10px' }}>{opt.icon}</div>
                    <div style={{ color: hasSeatMap === opt.value ? '#fff' : '#888', fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{opt.label}</div>
                    <div style={{ color: '#555', fontSize: '12px' }}>{opt.desc}</div>
                    {hasSeatMap === opt.value && (
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#2CC275', fontSize: '12px', fontWeight: '600' }}>
                        <FaCheck size={10} /> Đã chọn
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Khi bật sơ đồ → hiển thị nút mở SeatmapBuilderModal */}
              {hasSeatMap && (
                <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '28px', textAlign: 'center' }}>
                  {seatmapDone ? (
                    <div>
                      {/* Status card */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#0d1f16', border: '1px solid #2CC27530', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px', textAlign: 'left' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#2CC27520', border: '2px solid #2CC275', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FaCheck size={18} color="#2CC275" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#2CC275', fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>Sơ đồ chỗ ngồi đã được thiết lập</div>
                          <div style={{ color: '#555', fontSize: '12px' }}>Click "Xem sơ đồ" để kiểm tra và chỉnh sửa chi tiết</div>
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setShowSeatmapViewer(true)}
                          style={{ background: '#2CC275', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <FaEye size={12} /> Xem sơ đồ hiện tại
                        </button>
                        <button
                          onClick={() => { setSeatmapDone(false); setHasSeatMap(false); }}
                          style={{ background: 'transparent', border: '1px solid #2CC27560', color: '#2CC275', padding: '10px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <FaTrash size={11} /> Xóa & Tạo mới
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#2CC27515', border: '2px dashed #2CC27540', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <FaMapMarked size={26} color="#2CC275" />
                      </div>
                      <div style={{ color: '#555', fontSize: '13px', marginBottom: '8px', lineHeight: '1.6' }}>
                      </div>
                      {!editingId && (
                        <div style={{ background: '#FFC10715', border: '1px solid #FFC10740', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '12px', color: '#FFC107', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FaShieldAlt size={12} />
                          Sự kiện sẽ được lưu nháp tạm thời khi mở trình thiết lập để có thể liên kết hạng vé.
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          // Với event mới (chưa có id): tạo draft event trước
                          if (!editingId) {
                            try {
                              if (!eventData.title || !eventData.event_date || !eventData.location) {
                                alert('Vui lòng hoàn thành Step 1 (Tên, Ngày, Địa điểm) trước!');
                                return;
                              }
                              const payload = {
                                ...eventData,
                                category_id: parseInt(eventData.category_id),
                                status: 'draft',
                              };
                              const res = await api.post('/api/events', payload);
                              const newId = res.data.id;
                              setTempCreatedEventId(newId);
                              // Tạo vé tạm cho builder (cần vé để liên kết)
                              for (const ticket of ticketRows) {
                                if (!ticket.type) continue;
                                await api.post('/api/tickets', {
                                  event_id: newId,
                                  type: ticket.type,
                                  price: parseCurrency(ticket.price),
                                  quantity_available: parseInt(ticket.quantity_available) || 0,
                                });
                              }
                            } catch (err) {
                              alert('Lỗi tạo sự kiện nháp: ' + (err.response?.data?.msg || err.message));
                              return;
                            }
                          }
                          setShowSeatmapBuilder(true);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #2CC275, #1da562)', color: '#000',
                          border: 'none', padding: '14px 32px', borderRadius: '12px', cursor: 'pointer',
                          fontWeight: '700', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '10px',
                          boxShadow: '0 4px 20px rgba(44,194,117,0.4)', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        Thiết Lập Sơ Đồ
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #2a2a2a' }}>
                <button onClick={() => setWizardStep(2)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaArrowLeft size={12} /> Quay lại
                </button>
                <button onClick={() => setWizardStep(4)} style={{
                  background: 'linear-gradient(135deg, #2CC275, #1da562)', color: '#fff',
                  border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 15px rgba(44,194,117,0.3)',
                }}>
                  Tiếp theo <FaArrowRight />
                </button>
              </div>
            </div>
          )}

          {/* SeatmapViewerModal — xem sơ đồ hiện tại */}
          {showSeatmapViewer && (editingId || tempCreatedEventId) && (
            <SeatmapViewerModal
              event={{ id: editingId || tempCreatedEventId, title: eventData.title }}
              onClose={() => setShowSeatmapViewer(false)}
              onEdit={() => {
                setShowSeatmapViewer(false);
                setShowSeatmapBuilder(true);
                setSeatmapBuilderIsEditing(true);
              }}
              onDelete={async () => {
                if (!window.confirm('Bạn chắc chắn muốn xóa toàn bộ sơ đồ? (Không thể hoàn tác)')) return;
                try {
                  await api.delete(`/api/events/${editingId || tempCreatedEventId}/seatmap`);
                  setShowSeatmapViewer(false);
                  setSeatmapDone(false);
                  setHasSeatMap(false);
                } catch (err) {
                  alert('Lỗi xóa sơ đồ: ' + (err.response?.data?.msg || err.message));
                }
              }}
            />
          )}

          {/* SeatmapBuilderModal — fullscreen overlay */}
          {showSeatmapBuilder && (editingId || tempCreatedEventId) && (
            <SeatmapBuilderModal
              event={{ id: editingId || tempCreatedEventId, title: eventData.title }}
              onClose={() => { setShowSeatmapBuilder(false); setSeatmapBuilderIsEditing(false); }}
              isEditing={seatmapBuilderIsEditing}
              onSuccess={() => {
                setShowSeatmapBuilder(false);
                setSeatmapBuilderIsEditing(false);
                setSeatmapDone(true);
                setHasSeatMap(true);
              }}
            />
          )}

          {/* ─── Step 4: Cài đặt ─────────────────────────────────────────────── */}
          {wizardStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>

              {/* ── A: Minh chứng cấp phép ─────────────────────────────────────── */}
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid #222' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #1890ff, #096dd9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaShieldAlt size={13} color="#fff" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>Minh chứng cấp phép</div>
                    <div style={{ color: '#555', fontSize: '12px' }}>Tài liệu pháp lý và giấy phép tổ chức</div>
                  </div>
                </div>

                {/* Upload area */}
                <div
                  onClick={() => document.getElementById('license-upload').click()}
                  style={{ border: '2px dashed #2a2a2a', borderRadius: '14px', padding: '36px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s', marginBottom: '16px' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1890ff'; e.currentTarget.style.background = '#1890ff08'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <input id="license-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                    onChange={e => setLicenseFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  <FaShieldAlt size={26} style={{ color: '#333', marginBottom: '10px' }} />
                  <div style={{ color: '#888', fontSize: '14px', fontWeight: '600' }}>Nhấp để tải lên tài liệu</div>
                  <div style={{ color: '#444', fontSize: '12px', marginTop: '4px' }}>PDF, JPG, PNG — Giấy phép tổ chức, hợp đồng địa điểm, PCCC...</div>
                </div>


                {/* Existing saved files */}
                {existingLicenseUrls.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#2CC275', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✓ File đã lưu ({existingLicenseUrls.length})</div>
                    {existingLicenseUrls.map((url, i) => {
                      const filename = url.split('/').pop();
                      const isImage = /\.(jpg|jpeg|png)$/i.test(filename);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#1a2a1a', padding: '10px 16px', borderRadius: '10px', border: '1px solid #2CC27540' }}>
                          <FaFileAlt style={{ color: '#2CC275', fontSize: '15px', flexShrink: 0 }} />
                          <a href={url.startsWith('http') ? url : `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}${url}`} target="_blank" rel="noreferrer"
                            style={{ flex: 1, color: '#2CC275', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                            {filename}
                          </a>
                          <span style={{ background: '#2CC27520', color: '#2CC275', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>Đã lưu</span>
                          <button onClick={() => setExistingLicenseUrls(existingLicenseUrls.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '14px', padding: '4px' }}><FaTimes /></button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* New files pending upload */}
                {licenseFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#1890ff', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>+ Sắp tải lên ({licenseFiles.length})</div>
                    {licenseFiles.map((file, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#252535', padding: '10px 16px', borderRadius: '10px', border: '1px solid #1890ff40' }}>
                        <FaFileAlt style={{ color: '#1890ff', fontSize: '15px', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: '#ccc', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <span style={{ color: '#555', fontSize: '11px', flexShrink: 0 }}>{(file.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => setLicenseFiles(licenseFiles.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '14px', padding: '4px' }}><FaTimes /></button>
                      </div>
                    ))}
                  </div>
                )}


                <div>
                  <label style={labelStyle}>Ghi chú thêm (tùy chọn)</label>
                  <textarea
                    style={{ ...inputStyle, height: '90px', resize: 'vertical' }}
                    value={licenseNote} onChange={e => setLicenseNote(e.target.value)}
                    placeholder="Mô tả thêm về tài liệu hoặc thông tin cấp phép..."
                    onFocus={e => e.target.style.borderColor = '#1890ff'}
                    onBlur={e => e.target.style.borderColor = '#444'}
                  />
                </div>
              </div>

              {/* ── B: Thông tin thanh toán ──────────────────────────────────────── */}
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #2CC275, #1da562)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaTicketAlt size={13} color="#fff" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>Thông tin thanh toán</div>
                    <div style={{ color: '#555', fontSize: '12px' }}>Doanh thu bán vé sẽ được chuyển về tài khoản ngân hàng sau khi kết thúc sự kiện</div>
                  </div>
                </div>

                {/* Info banner */}
                <div style={{ background: '#2CC27510', border: '1px solid #2CC27530', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '12px', color: '#2CC27599', lineHeight: '1.6' }}>
                  ⓘ&nbsp; Tiền bán vé (sau khi trừ phí dịch vụ) sẽ được chuyển về trong vòng <strong style={{color:'#2CC275'}}>7–10 ngày làm việc</strong> sau khi xác nhận báo cáo doanh thu. Liên hệ support@titicket.vn nếu cần hỗ trợ sớm hơn.
                </div>

                {/* Bank account fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '24px' }}>
                  <div>
                    <label style={labelStyle}>Chủ tài khoản <span style={{color:'#ff4d4f'}}>*</span></label>
                    <input style={inputStyle} placeholder="Nguyễn Văn A"
                      value={paymentInfo.accountHolder}
                      onChange={e => setPaymentInfo(p => ({...p, accountHolder: e.target.value}))}
                      onFocus={e => e.target.style.borderColor = '#2CC275'} onBlur={e => e.target.style.borderColor = '#444'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Số tài khoản <span style={{color:'#ff4d4f'}}>*</span></label>
                    <input style={inputStyle} placeholder="0123456789" type="text" inputMode="numeric"
                      value={paymentInfo.accountNumber}
                      onChange={e => setPaymentInfo(p => ({...p, accountNumber: e.target.value.replace(/\D/g,'').slice(0,20)}))}
                      onFocus={e => e.target.style.borderColor = '#2CC275'} onBlur={e => e.target.style.borderColor = '#444'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tên ngân hàng <span style={{color:'#ff4d4f'}}>*</span></label>
                    <select style={selectStyle}
                      value={paymentInfo.bankName}
                      onChange={e => setPaymentInfo(p => ({...p, bankName: e.target.value}))}
                      onFocus={e => e.target.style.borderColor = '#2CC275'} onBlur={e => e.target.style.borderColor = '#444'}
                    >
                      <option value="">Chọn ngân hàng...</option>
                      {['Vietcombank','Techcombank','BIDV','Agribank','MB Bank','VPBank','TPBank','VietinBank','SHB','ACB','Sacombank','HDBank','SeABank','Nam A Bank','OCB','VIB','Eximbank','LienVietPostBank'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Chi nhánh</label>
                    <input style={inputStyle} placeholder="Chi nhánh Hà Nội..."
                      value={paymentInfo.branch}
                      onChange={e => setPaymentInfo(p => ({...p, branch: e.target.value}))}
                      onFocus={e => e.target.style.borderColor = '#2CC275'} onBlur={e => e.target.style.borderColor = '#444'} />
                  </div>
                </div>
              </div>

              {/* ── Navigation buttons ──────────────────────────────────────────── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
                <button onClick={() => setWizardStep(3)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaArrowLeft size={12} /> Quay lại
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {editingId && (
                    <button onClick={() => { resetWizard(); setActiveTab('events_list'); }} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FaTimes size={12} /> Hủy
                    </button>
                  )}
                  <button
                    onClick={handleFinalSubmit}
                    style={{
                      background: editingId
                        ? 'linear-gradient(135deg, #FFC107, #e6a800)'
                        : 'linear-gradient(135deg, #2CC275, #1da562)',
                      color: editingId ? '#000' : '#fff',
                      border: 'none', padding: '14px 36px', borderRadius: '10px', cursor: 'pointer',
                      fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px',
                      boxShadow: editingId ? '0 4px 15px rgba(255,193,7,0.3)' : '0 4px 20px rgba(44,194,117,0.4)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {editingId ? <><FaSave /> Lưu thay đổi</> : <><FaCheck /> Tạo sự kiện</>}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {activeTab === 'pending' && (
        <>
          <h3 style={{ marginBottom: '16px', fontSize: '20px', borderLeft: '4px solid #2CC275', paddingLeft: '12px' }}>
            Sự kiện chờ duyệt ({pendingEvents.length})
          </h3>
          {pendingEvents.length === 0 ? (
            <div style={{ background: '#1e1e1e', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#666', border: '1px solid #333' }}>
              Không có sự kiện nào đang chờ duyệt
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pendingEvents.map(ev => (
                <div key={ev.id} style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', padding: '20px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <img src={ev.image_url} alt="" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} onError={e => e.target.src = 'https://via.placeholder.com/120'} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px' }}>{ev.title}</h4>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                      <span><FaClock style={{color: "#aaa", marginRight:"4px"}}/> {new Date(ev.event_date).toLocaleDateString('vi-VN')}</span>
                      <span><FaMapMarkerAlt style={{color: "#aaa", marginRight:"4px"}}/> {ev.location}</span>
                      <span><FaTag style={{color: "#aaa", marginRight:"4px"}}/> {ev.category_name}</span>
                      <span><FaUser style={{color: "#aaa", marginRight:"4px"}}/> {ev.creator_email}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setViewingEvent(ev)}
                        style={{ background: 'transparent', border: '1px solid #2CC275', color: '#2CC275', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <FaEye size={12} /> Xem chi tiết
                      </button>
                      <button onClick={() => handleApproveEvent(ev.id)} style={{ background: '#2CC275', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaCheck /> Duyệt
                      </button>
                      <button onClick={() => handleRejectEvent(ev.id)} style={{ background: '#ff4d4f20', color: '#ff4d4f', border: '1px solid #ff4d4f60', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaBan /> Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modal: Xem chi tiết sự kiện chờ duyệt ── */}
      {viewingPendingEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewingPendingEvent(null)}>
          <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '1px solid #2CC27530', width: '100%', maxWidth: '760px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ color: '#FFC107', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Chờ duyệt</div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: '700' }}>{viewingPendingEvent.event.title}</h3>
              </div>
              <button onClick={() => setViewingPendingEvent(null)} style={{ background: '#2a2a2a', border: 'none', color: '#888', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}><FaTimes /></button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* Banner */}
              {viewingPendingEvent.event.image_url && (
                <img src={viewingPendingEvent.event.image_url.startsWith('http') ? viewingPendingEvent.event.image_url : `http://localhost:5001${viewingPendingEvent.event.image_url}`}
                  alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '20px' }}
                  onError={e => e.target.style.display='none'} />
              )}
              {/* Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Ngày diễn', value: new Date(viewingPendingEvent.event.event_date).toLocaleString('vi-VN') },
                  { label: 'Địa điểm', value: viewingPendingEvent.event.location },
                  { label: 'Ban tổ chức', value: viewingPendingEvent.event.organizer || '—' },
                  { label: 'Người tạo', value: viewingPendingEvent.event.creator_email },
                  { label: 'Thể loại', value: viewingPendingEvent.event.category_name || '—' },
                  { label: 'ID sự kiện', value: `#${viewingPendingEvent.event.id}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#111', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                    <div style={{ color: '#ddd', fontSize: '13px' }}>{value}</div>
                  </div>
                ))}
              </div>
              {/* Description — collapsible */}
              {viewingPendingEvent.event.description && (
                <div style={{ background: '#111', borderRadius: '10px', marginBottom: '20px', overflow: 'hidden' }}>
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mô tả sự kiện</span>
                    <span style={{ color: '#2CC275', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {descExpanded ? '▲ Thu gọn' : '▼ Xem thêm'}
                    </span>
                  </button>
                  {descExpanded && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <div className="event-description-html" style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.7' }}
                        dangerouslySetInnerHTML={{ __html: viewingPendingEvent.event.description }} />
                    </div>
                  )}
                  {!descExpanded && (
                    <div style={{ padding: '0 16px 14px', color: '#555', fontSize: '12px', fontStyle: 'italic' }}>
                      {viewingPendingEvent.event.description?.replace(/<[^>]*>/g, '').substring(0, 120)}...
                    </div>
                  )}
                </div>
              )}
              {/* Tickets */}
              {viewingPendingEvent.tickets.length > 0 && (
                <div style={{ background: '#111', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>Hạng vé ({viewingPendingEvent.tickets.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewingPendingEvent.tickets.map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', borderRadius: '8px', padding: '10px 14px', border: '1px solid #2a2a2a' }}>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{t.type}</div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <span style={{ color: '#2CC275', fontWeight: '700', fontSize: '13px' }}>
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(t.price)}
                          </span>
                          <span style={{ color: '#555', fontSize: '12px' }}>{t.quantity_available} vé</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Footer actions */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setViewingPendingEvent(null)} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Đóng</button>
              <button onClick={() => { handleRejectEvent(viewingPendingEvent.event.id); setViewingPendingEvent(null); }} style={{ background: '#ff4d4f20', color: '#ff4d4f', border: '1px solid #ff4d4f60', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaBan size={12} /> Từ chối
              </button>
              <button onClick={() => { handleApproveEvent(viewingPendingEvent.event.id); setViewingPendingEvent(null); }} style={{ background: '#2CC275', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaCheck size={12} /> Duyệt sự kiện
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <>
          <h3 style={{ marginBottom: '16px', fontSize: '20px', borderLeft: '4px solid #2CC275', paddingLeft: '12px' }}>
            Yêu cầu trở thành Đối tác ({organizerRequests.length})
          </h3>
          {organizerRequests.length === 0 ? (
            <div style={{ background: '#1e1e1e', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#666', border: '1px solid #333' }}>
              Chưa có yêu cầu nào
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e' }}>
                <thead>
                  <tr style={{ background: '#252525', textAlign: 'left', color: '#aaa', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={thStyle}>User</th><th style={thStyle}>Tên tổ chức</th><th style={thStyle}>SĐT</th><th style={thStyle}>Lời nhắn</th><th style={thStyle}>Trạng thái</th><th style={thStyle}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {organizerRequests.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={tdStyle}><span style={{ color: '#fff', fontSize: '13px' }}>{r.user_email}</span></td>
                      <td style={tdStyle}><span style={{ color: '#2CC275', fontWeight: '600' }}>{r.org_name}</span></td>
                      <td style={tdStyle}><span style={{ color: '#aaa', fontSize: '13px' }}>{r.phone || '—'}</span></td>
                      <td style={tdStyle}><span style={{ color: '#888', fontSize: '13px' }}>{r.message?.substring(0, 60) || '—'}{r.message?.length > 60 ? '...' : ''}</span></td>
                      <td style={tdStyle}><StatusBadge status={r.status} /></td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button onClick={() => setViewingOrgRequest(r)} style={{ ...btnSmall, background: 'transparent', border: '1px solid #2CC27560', color: '#2CC275' }}><FaEye size={10} /> Xem</button>
                          {r.status === 'pending' ? (
                            <>
                              <button onClick={() => handleApproveRequest(r.id)} style={{ ...btnSmall, background: '#2CC275', color: '#000' }}><FaCheck /></button>
                              <button onClick={() => handleRejectRequest(r.id)} style={{ ...btnSmall, background: '#ff4d4f20', color: '#ff4d4f', border: '1px solid #ff4d4f60' }}><FaBan /></button>
                            </>
                          ) : (
                            <span style={{ color: '#666', fontSize: '12px' }}>Đã xử lý</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal: Xem chi tiết đơn đăng ký Đối tác ── */}
      {viewingOrgRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewingOrgRequest(null)}>
          <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '1px solid #2CC27530', width: '100%', maxWidth: '560px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#2CC275', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Đơn đăng ký Đối tác</div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: '700' }}>{viewingOrgRequest.org_name}</h3>
              </div>
              <button onClick={() => setViewingOrgRequest(null)} style={{ background: '#2a2a2a', border: 'none', color: '#888', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}><FaTimes /></button>
            </div>
            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Email', value: viewingOrgRequest.user_email },
                  { label: 'Điện thoại', value: viewingOrgRequest.phone || '—' },
                  { label: 'Tên tổ chức', value: viewingOrgRequest.org_name },
                  { label: 'Trạng thái', value: viewingOrgRequest.status === 'pending' ? 'Chờ duyệt' : viewingOrgRequest.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#111', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                    <div style={{ color: '#ddd', fontSize: '13px' }}>{value}</div>
                  </div>
                ))}
              </div>
              {viewingOrgRequest.message && (
                <div style={{ background: '#111', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ color: '#555', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>Lời nhắn đầy đủ</div>
                  <p style={{ color: '#bbb', fontSize: '13px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{viewingOrgRequest.message}</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setViewingOrgRequest(null)} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Đóng</button>
              {viewingOrgRequest.status === 'pending' && (
                <>
                  <button onClick={() => { handleRejectRequest(viewingOrgRequest.id); setViewingOrgRequest(null); }} style={{ background: '#ff4d4f20', color: '#ff4d4f', border: '1px solid #ff4d4f60', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaBan size={12} /> Từ chối
                  </button>
                  <button onClick={() => { handleApproveRequest(viewingOrgRequest.id); setViewingOrgRequest(null); }} style={{ background: '#2CC275', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaHandshake size={12} /> Chấp nhận đối tác
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <>
          <h3 style={{ marginBottom: '16px', fontSize: '20px', borderLeft: '4px solid #1890ff', paddingLeft: '12px' }}>
            Quản lý Users ({users.length})
          </h3>
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #333' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e' }}>
              <thead>
                <tr style={{ background: '#252525', textAlign: 'left', color: '#aaa', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={thStyle}>ID</th><th style={thStyle}>Email</th><th style={thStyle}>Vai trò</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={tdStyle}>#{u.id}</td>
                    <td style={tdStyle}><span style={{ color: '#fff' }}>{u.email}</span></td>
                    <td style={tdStyle}><RoleBadge role={u.role} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#ccc', fontSize: '13px' };
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: 'white', width: '100%', boxSizing: 'border-box', fontSize: '14px', outline: 'none', transition: 'border-color 0.15s' };
const selectStyle = { ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '14px', paddingRight: '44px' };
const thStyle = { padding: '12px 16px', fontWeight: '600' };
const tdStyle = { padding: '14px 16px', verticalAlign: 'middle' };
const btnSmall = { border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', fontSize: '12px' };

export default AdminPage;