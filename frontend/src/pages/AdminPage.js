import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaTrash, FaPlus, FaStar, FaEdit, FaTimes, FaSave } from "react-icons/fa";

const AdminPage = () => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]); 
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [eventData, setEventData] = useState({
    title: '', description: '', location: '', image_url: '', 
    event_date: '', end_date: '', 
    organizer: '', 
    category_id: '', 
    is_featured: false 
  });

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [ticketRows, setTicketRows] = useState([
    { type: 'Vé Thường', price: '', quantity_available: 100 } 
  ]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/events');
      setEvents(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/categories');
      setCategories(res.data);
      if (res.data.length > 0 && !editingId) {
        setEventData(prev => ({ ...prev, category_id: res.data[0].id }));
      }
    } catch (err) { console.error("Lỗi lấy danh mục:", err); }
  }, [editingId]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
      alert("Bạn không có quyền truy cập!");
      navigate('/');
      return;
    }
    fetchEvents();
    fetchCategories();
  }, [navigate, fetchEvents, fetchCategories]);

  const formatDateForInput = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const stringValue = String(value);
    const number = stringValue.replace(/\D/g, '');
    if (number === '') return '';
    return new Intl.NumberFormat('vi-VN').format(number);
  };

  const parseCurrency = (value) => {
    if (!value) return 0;
    return parseInt(String(value).replace(/\./g, ''), 10) || 0;
  };

  const handleTicketChange = (index, field, value) => {
    const newTickets = [...ticketRows];
    
    if (field === 'price') {
      const rawValue = value.replace(/\./g, '');
      if (!isNaN(rawValue)) {
         newTickets[index][field] = formatCurrency(rawValue);
      }
    } else {
      newTickets[index][field] = value;
    }
    
    setTicketRows(newTickets);
  };

  const addTicketRow = () => setTicketRows([...ticketRows, { type: '', price: '', quantity_available: 0 }]);
  
  const removeTicketRow = (index) => {
    if (ticketRows.length === 1) return; 
    setTicketRows(ticketRows.filter((_, i) => i !== index));
  };

  const handleEditClick = (event) => {
    setEditingId(event.id); 
    setEventData({
        title: event.title,
        description: event.description || '',
        location: event.location,
        image_url: event.image_url,
        event_date: formatDateForInput(event.event_date),
        end_date: formatDateForInput(event.end_date),
        organizer: event.organizer || '',
        category_id: event.category_id,
        is_featured: event.is_featured
    });
    setTicketRows([]); 
    setIsAddingCategory(false); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEventData({ 
        title: '', description: '', location: '', image_url: '', 
        event_date: '', end_date: '', organizer: '', 
        category_id: categories.length > 0 ? categories[0].id : '', 
        is_featured: false 
    });
    setTicketRows([{ type: 'Vé Thường', price: '', quantity_available: 100 }]);
    setIsAddingCategory(false);
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
      if (!newCategoryName.trim()) {
          alert("Vui lòng nhập tên thể loại mới!");
          return;
      }
      try {
          const res = await axios.post('http://127.0.0.1:5000/api/categories', { name: newCategoryName });
          const newCat = res.data;
          setCategories([...categories, newCat]);
          setEventData(prev => ({ ...prev, category_id: newCat.id }));
          setIsAddingCategory(false);
          setNewCategoryName('');
          alert(`Đã thêm thể loại "${newCat.name}" thành công!`);

      } catch (err) {
          console.error(err);
          alert("Lỗi khi tạo thể loại mới.");
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const config = { headers: { 'x-auth-token': token } };

    try {
      // Validate
      if (isAddingCategory) {
          alert("Vui lòng lưu thể loại mới trước khi tạo sự kiện (Bấm nút nhỏ bên cạnh ô nhập).");
          return;
      }
      if (!eventData.category_id) { alert("Vui lòng chọn thể loại!"); return; }

      const payloadEvent = {
          ...eventData,
          category_id: parseInt(eventData.category_id)
      };

      if (editingId) {
        await axios.put(`http://127.0.0.1:5000/api/events/${editingId}`, payloadEvent, config);
        alert("Cập nhật sự kiện thành công!");
      } else {
        console.log("Đang tạo mới:", eventData);
        const eventRes = await axios.post('http://127.0.0.1:5000/api/events', payloadEvent, config);
        const newEventId = eventRes.data.id;

        if (ticketRows.length > 0) {
            for (const ticket of ticketRows) {
                const realPrice = parseCurrency(ticket.price);
                const realQuantity = parseInt(ticket.quantity_available);
                await axios.post('http://127.0.0.1:5000/api/tickets', {
                    event_id: newEventId,
                    type: ticket.type,
                    price: realPrice, 
                    quantity_available: realQuantity
                }, config);
            }
        }
        alert("Tạo sự kiện mới thành công!");
      }

      fetchEvents();
      handleCancelEdit(); 

    } catch (err) {
      console.error("Lỗi Frontend:", err);
      const errorMsg = err.response?.data?.msg || "Có lỗi xảy ra!";
      alert("Lỗi: " + errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa sự kiện này?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://127.0.0.1:5000/api/events/${id}`, { headers: { 'x-auth-token': token } });
      alert("Đã xóa thành công!");
      fetchEvents();
    } catch (err) { alert("Lỗi khi xóa!"); }
  };

  return (
    <div className="container" style={{ padding: '40px 20px', color: '#eee', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#2CC275', textAlign: 'center', marginBottom: '40px', fontSize: '32px' }}>Quản Trị Hệ Thống</h1>
      
      {/* FORM INPUT */}
      <div style={{ background: '#1e1e1e', padding: '40px', borderRadius: '16px', marginBottom: '50px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
            <h3 style={{ margin: 0, color: editingId ? '#FFC107' : '#2CC275', fontSize: '24px', display: 'flex', alignItems: 'center' }}>
                {editingId ? <><FaEdit style={{ marginRight: '10px' }} /> Chỉnh Sửa Sự Kiện</> : <><FaPlus style={{ marginRight: '10px' }} /> Thêm Sự Kiện Mới</>}
            </h3>
            {editingId && (
                <button onClick={handleCancelEdit} style={{ background: 'transparent', border: '1px solid #aaa', color: '#aaa', padding: '5px 15px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                    <FaTimes /> Hủy bỏ
                </button>
            )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px 40px', marginBottom: '30px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div><label style={labelStyle}>Tên sự kiện <span style={{color: 'red'}}>*</span></label><input style={inputStyle} required value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})} placeholder="Nhập tên sự kiện..." /></div>
                
                {/* --- PHẦN THỂ LOẠI (CÓ LOGIC THÊM MỚI) --- */}
                <div>
                    <label style={labelStyle}>Thể loại <span style={{color: 'red'}}>*</span></label>
                    
                    {!isAddingCategory ? (
                        // 1. SELECT BOX
                        <select 
                            style={selectStyle} 
                            value={eventData.category_id} 
                            onChange={handleCategoryChange}
                        >
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                            <option value="new_category_option" style={{fontWeight: 'bold', color: '#2CC275'}}>Thêm thể loại mới...</option>
                        </select>
                    ) : (
                        // 2. INPUT NHẬP MỚI (Hiện ra khi chọn "Thêm mới")
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input 
                                style={inputStyle} 
                                autoFocus
                                placeholder="Nhập tên thể loại mới..." 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                            <button type="button" onClick={handleSaveNewCategory} style={{ background: '#2CC275', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' }} title="Lưu thể loại">
                                <FaSave />
                            </button>
                            <button type="button" onClick={() => setIsAddingCategory(false)} style={{ background: '#444', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' }} title="Hủy">
                                <FaTimes />
                            </button>
                        </div>
                    )}
                </div>

                <div><label style={labelStyle}>Ban tổ chức <span style={{color: 'red'}}>*</span></label><input style={inputStyle} required value={eventData.organizer} onChange={e => setEventData({...eventData, organizer: e.target.value})} placeholder="Đơn vị tổ chức..." /></div>
                <div><label style={labelStyle}>Địa điểm <span style={{color: 'red'}}>*</span></label><input style={inputStyle} required value={eventData.location} onChange={e => setEventData({...eventData, location: e.target.value})} placeholder="Địa chỉ tổ chức..." /></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div><label style={labelStyle}>Link ảnh bìa (URL) <span style={{color: 'red'}}>*</span></label><input style={inputStyle} required value={eventData.image_url} onChange={e => setEventData({...eventData, image_url: e.target.value})} placeholder="https://example.com/image.jpg" /></div>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}><label style={labelStyle}>Bắt đầu <span style={{color: 'red'}}>*</span></label><input type="datetime-local" style={inputStyle} required value={eventData.event_date} onChange={e => setEventData({...eventData, event_date: e.target.value})} /></div>
                    <div style={{ flex: 1 }}><label style={labelStyle}>Kết thúc</label><input type="datetime-local" style={inputStyle} required value={eventData.end_date} onChange={e => setEventData({...eventData, end_date: e.target.value})} /></div>
                </div>
                <div style={{ background: '#2a2a2a', padding: '15px', borderRadius: '8px', border: '1px solid #444', display: 'flex', alignItems: 'center' }}>
                    <input 
                        type="checkbox" 
                        id="is_featured"
                        checked={eventData.is_featured}
                        onChange={e => setEventData({...eventData, is_featured: e.target.checked})}
                        style={{ width: '20px', height: '20px', marginRight: '15px', accentColor: '#2CC275', cursor: 'pointer' }}
                    />
                    <label htmlFor="is_featured" style={{ cursor: 'pointer', fontWeight: 'bold', color: eventData.is_featured ? '#2CC275' : '#ddd', display: 'flex', alignItems: 'center', fontSize: '16px' }}>
                        <FaStar style={{ marginRight: '8px', marginBottom: '2px' }} /> Đặt làm Sự Kiện Nổi Bật
                    </label>
                </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Mô tả chi tiết</label><textarea style={{ ...inputStyle, height: '120px', lineHeight: '1.5', resize: 'vertical' }} required value={eventData.description} onChange={e => setEventData({...eventData, description: e.target.value})} placeholder="Nhập thông tin chi tiết về sự kiện..." /></div>
          </div>

          {/* CHỈ HIỆN PHẦN VÉ KHI ĐANG TẠO MỚI */}
          {!editingId && (
              <div style={{ background: '#252525', padding: '25px', borderRadius: '12px', marginBottom: '30px', border: '1px dashed #555' }}>
                <h4 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '18px' }}>Thiết lập hạng vé</h4>
                {ticketRows.map((ticket, index) => (
                  <div key={index} style={{ display: 'flex', gap: '20px', marginBottom: '15px', alignItems: 'flex-end', background: '#333', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ flex: 2 }}><label style={{ fontSize: '13px', color: '#aaa', marginBottom: '5px', display: 'block' }}>Tên hạng vé (VD: VIP)</label><input style={inputStyle} required value={ticket.type} onChange={(e) => handleTicketChange(index, 'type', e.target.value)} /></div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '13px', color: '#aaa', marginBottom: '5px', display: 'block' }}>Giá vé (VNĐ)</label><input type="text" style={{...inputStyle, fontWeight: 'bold', color: '#2CC275'}} required value={ticket.price} placeholder="0" onChange={(e) => handleTicketChange(index, 'price', e.target.value)} /></div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '13px', color: '#aaa', marginBottom: '5px', display: 'block' }}>Số lượng</label><input type="number" style={inputStyle} required value={ticket.quantity_available} onChange={(e) => handleTicketChange(index, 'quantity_available', e.target.value)} /></div>
                    {ticketRows.length > 1 && (<button type="button" onClick={() => removeTicketRow(index)} style={{ background: '#ff4d4f', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTrash /></button>)}
                  </div>
                ))}
                <button type="button" onClick={addTicketRow} style={{ marginTop: '10px', background: 'transparent', color: '#2CC275', border: '1px dashed #2CC275', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>+ Thêm hạng vé khác</button>
              </div>
          )}

          <button type="submit" style={{ width: '100%', background: editingId ? '#FFC107' : '#2CC275', color: editingId ? 'black' : 'white', border: 'none', padding: '18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.3s' }}>
            {editingId ? 'LƯU THAY ĐỔI' : 'XÁC NHẬN TẠO SỰ KIỆN'}
          </button>
        </form>
      </div>

      {/* DANH SÁCH SỰ KIỆN */}
      <h3 style={{ marginBottom: '25px', fontSize: '24px', borderLeft: '5px solid #2CC275', paddingLeft: '15px' }}>Danh sách sự kiện ({events.length})</h3>
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #333' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e' }}>
          <thead>
            <tr style={{ background: '#252525', textAlign: 'left', color: '#aaa', textTransform: 'uppercase', fontSize: '14px' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Thông tin sự kiện</th>
              <th style={thStyle}>Ban tổ chức</th>
              <th style={thStyle}>Thời gian</th>
              <th style={thStyle}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={tdStyle}>#{ev.id}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src={ev.image_url} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} onError={(e) => { e.target.src="https://via.placeholder.com/60" }} />
                    <div>
                        <div style={{fontWeight: 'bold', fontSize: '16px', color: '#fff'}}>{ev.title}</div>
                        <div style={{fontSize: '13px', color: '#888'}}>{ev.location}</div>
                        {ev.is_featured && <span style={{fontSize: '11px', background: 'gold', color: 'black', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginTop: '4px', display: 'inline-block'}}>Nổi bật</span>}
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>{ev.organizer || '---'}</td>
                <td style={tdStyle}>
                   <div style={{fontSize: '14px', fontWeight: 'bold', color: '#ccc'}}>{new Date(ev.event_date).toLocaleDateString('vi-VN')}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleEditClick(ev)} style={{ background: '#FFC107', color: 'black', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                        <FaEdit /> Sửa
                    </button>
                    <button onClick={() => handleDelete(ev.id)} style={{ background: '#ff4d4f20', color: '#ff4d4f', border: '1px solid #ff4d4f', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                        <FaTrash /> Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#ccc', fontSize: '14px' };
const inputStyle = { padding: '12px 15px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: 'white', width: '100%', boxSizing: 'border-box', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' };
const selectStyle = { ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 15px center', backgroundSize: '16px', paddingRight: '40px' };
const thStyle = { padding: '15px 20px', fontWeight: '600' };
const tdStyle = { padding: '15px 20px', verticalAlign: 'middle' };

export default AdminPage;