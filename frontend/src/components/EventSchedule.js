import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { FaList, FaCalendarAlt, FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp } from 'react-icons/fa';

// ===== Helpers =====
const DAYS_VN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const MONTHS_VN = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
};

const formatDateVN = (dateStr) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day} Tháng ${month}, ${year}`;
};

const getDayOfWeekVN = (dateStr) => {
  const d = new Date(dateStr);
  // getDay() returns 0 (Sun) - 6 (Sat), we need VN day name short
  const dayIndex = d.getDay();
  // 0=CN, 1=T2, 2=T3 ... 6=T7
  const map = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return map[dayIndex];
};

// ===== Sub-components =====

// Month tab in header
const MonthTab = ({ month, year, count, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      border: 'none',
      color: isActive ? '#2CC275' : '#aaa',
      cursor: 'pointer',
      padding: '12px 20px',
      textAlign: 'center',
      borderBottom: isActive ? '2px solid #2CC275' : '2px solid transparent',
      transition: 'all 0.2s',
      minWidth: '120px',
      flexShrink: 0,
    }}
  >
    <div style={{ fontSize: '15px', fontWeight: isActive ? '700' : '500' }}>
      {`${MONTHS_VN[month]}, ${year}`}
    </div>
    <div style={{ fontSize: '12px', marginTop: '2px', color: isActive ? '#2CC275' : '#888' }}>
      {count} suất diễn
    </div>
  </button>
);

// Calendar Day Cell
const CalendarDay = ({ day, isCurrentMonth, hasEvent, isToday, onClick }) => (
  <div
    onClick={hasEvent ? onClick : undefined}
    style={{
      textAlign: 'center',
      padding: '10px 4px',
      cursor: hasEvent ? 'pointer' : 'default',
      color: !isCurrentMonth ? '#555' : hasEvent ? '#fff' : '#888',
      fontWeight: isToday ? '700' : hasEvent ? '600' : '400',
      position: 'relative',
      borderRadius: '8px',
      transition: 'all 0.2s',
      border: isToday ? '1px solid #2CC27580' : '1px solid transparent',
      minHeight: '48px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      ...(hasEvent && {
        ':hover': {
          background: '#2CC27520',
        }
      })
    }}
    onMouseEnter={e => {
      if (hasEvent) e.currentTarget.style.background = '#2CC27515';
    }}
    onMouseLeave={e => {
      if (hasEvent) e.currentTarget.style.background = 'transparent';
    }}
  >
    <span style={{ fontSize: '15px' }}>{day || ''}</span>
    {hasEvent && (
      <div style={{
        width: '20px',
        height: '4px',
        borderRadius: '2px',
        background: '#2CC275',
        marginTop: '4px'
      }} />
    )}
  </div>
);

// List Item (expandable)
const ScheduleListItem = ({ schedule, tickets, event, isExpanded, onToggle, onBuyTicket }) => {
  const dayName = getDayOfWeekVN(schedule.schedule_date);
  const dateFormatted = formatDateVN(schedule.schedule_date);
  const timeRange = `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`;

  // Use per-day ticket data if available, otherwise fallback to event tickets
  const dayTickets = schedule.tickets && schedule.tickets.length > 0
    ? schedule.tickets
    : tickets.map(t => ({ ticket_id: t.id, ticket_type: t.type, ticket_price: t.price, daily_quantity: null, daily_available: null }));

  const hasDailyData = schedule.tickets && schedule.tickets.length > 0;
  const totalDailyAvailable = hasDailyData ? dayTickets.reduce((sum, t) => sum + (t.daily_available || 0), 0) : null;
  const isSoldOut = hasDailyData && totalDailyAvailable === 0;

  return (
    <div style={{
      borderBottom: '1px solid #333',
      transition: 'all 0.3s',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isExpanded ? (
            <FaChevronDown style={{ color: '#2CC275', fontSize: '12px', flexShrink: 0 }} />
          ) : (
            <FaChevronUp style={{ color: '#888', fontSize: '12px', flexShrink: 0, transform: 'rotate(180deg)' }} />
          )}
          <div>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: '500' }}>
              {timeRange}, {dayName}
            </div>
            <div style={{ fontSize: '13px', color: '#2CC275', fontWeight: '600', marginTop: '2px' }}>
              {dateFormatted}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasDailyData && (
            <span style={{
              fontSize: '12px',
              color: isSoldOut ? '#ff4d4f' : '#888',
              fontWeight: '500',
            }}>
              {isSoldOut ? 'Hết vé' : `Còn ${totalDailyAvailable} vé`}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isSoldOut) return;
              onBuyTicket(schedule);
            }}
            disabled={isSoldOut}
            style={{
              background: isSoldOut ? '#555' : '#2CC275',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isSoldOut ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!isSoldOut) {
                e.currentTarget.style.background = '#25a562';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={e => {
              if (!isSoldOut) {
                e.currentTarget.style.background = '#2CC275';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isSoldOut ? 'Hết vé' : 'Mua vé ngay'}
          </button>
        </div>
      </div>

      {/* Expanded ticket info */}
      {isExpanded && (
        <div style={{
          padding: '0 24px 20px 56px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#ccc',
            marginBottom: '12px',
          }}>
            Thông tin vé
          </div>
          {dayTickets.map((ticket, idx) => {
            const available = ticket.daily_available;
            const isTkSoldOut = hasDailyData && available === 0;
            return (
              <div key={ticket.ticket_id || idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                background: '#2a2a2a',
                borderRadius: '8px',
                marginBottom: '8px',
                border: '1px solid #3a3a3a',
                opacity: isTkSoldOut ? 0.5 : 1,
              }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#eee', fontWeight: '500' }}>
                    {ticket.ticket_type || ticket.type}
                  </div>
                  {hasDailyData && (
                    <div style={{ fontSize: '11px', color: isTkSoldOut ? '#ff4d4f' : '#888', marginTop: '3px' }}>
                      {isTkSoldOut ? 'Hết vé' : `Còn ${available} vé`}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '14px', color: '#2CC275', fontWeight: '700' }}>
                  {new Intl.NumberFormat('vi-VN').format(ticket.ticket_price || ticket.price)} đ
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ===== Main Component =====
const EventSchedule = ({ eventId, event, tickets, onSelectDate }) => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [expandedScheduleId, setExpandedScheduleId] = useState(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchSchedules();
  }, [eventId]); // eslint-disable-line

  const fetchSchedules = async () => {
    try {
      const res = await api.get(`/api/events/${eventId}/schedules`);
      setSchedules(res.data);
      
      // Set initial month to the first schedule date
      if (res.data.length > 0) {
        const firstDate = new Date(res.data[0].schedule_date);
        setCurrentMonth(firstDate.getMonth());
        setCurrentYear(firstDate.getFullYear());
        // Auto-expand first schedule
        setExpandedScheduleId(res.data[0].id);
      }
    } catch (err) {
      console.error('Lỗi tải lịch diễn:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group schedules by month
  const schedulesByMonth = useMemo(() => {
    const groups = {};
    schedules.forEach(s => {
      const d = new Date(s.schedule_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!groups[key]) {
        groups[key] = { year: d.getFullYear(), month: d.getMonth(), schedules: [] };
      }
      groups[key].schedules.push(s);
    });
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [schedules]);

  // Schedule dates set for quick lookup
  const scheduleDatesSet = useMemo(() => {
    const set = new Set();
    schedules.forEach(s => {
      const d = new Date(s.schedule_date);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [schedules]);


  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // Day of week for the first day (Mon=0 ... Sun=6)
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon-based

    const days = [];
    
    // Previous month days
    const prevMonthLast = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const day = prevMonthLast - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      days.push({
        day,
        isCurrentMonth: false,
        hasEvent: scheduleDatesSet.has(`${prevYear}-${prevMonth}-${day}`),
        date: new Date(prevYear, prevMonth, day),
      });
    }

    // Current month days
    const today = new Date();
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        hasEvent: scheduleDatesSet.has(`${currentYear}-${currentMonth}-${d}`),
        isToday: today.getDate() === d && today.getMonth() === currentMonth && today.getFullYear() === currentYear,
        date: new Date(currentYear, currentMonth, d),
      });
    }

    // Next month days to fill the grid
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        days.push({
          day: i,
          isCurrentMonth: false,
          hasEvent: scheduleDatesSet.has(`${nextYear}-${nextMonth}-${i}`),
          date: new Date(nextYear, nextMonth, i),
        });
      }
    }

    return days;
  }, [currentMonth, currentYear, scheduleDatesSet]);

  const handleBuyTicket = (schedule) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Vui lòng đăng nhập để mua vé!");
      navigate('/login');
      return;
    }

    const scheduleInfo = {
      selected_date: schedule.schedule_date,
      schedule_time: `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
    };

    if (tickets.length === 1) {
      // If only one ticket type, go directly to checkout
      navigate('/checkout', {
        state: {
          event: {
            ...event,
            ...scheduleInfo,
          },
          ticket: tickets[0]
        }
      });
    } else {
      // Notify parent of selected date, then scroll to ticket section
      if (onSelectDate) {
        onSelectDate(scheduleInfo);
      }
      const ticketSection = document.getElementById('ticket-section');
      if (ticketSection) {
        ticketSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const navigateMonth = (direction) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  if (loading) return null;
  if (schedules.length === 0) return null;

  // Determine which months to show as tabs
  const visibleMonths = schedulesByMonth.length > 0 ? schedulesByMonth : [{
    year: currentYear, month: currentMonth, schedules: []
  }];

  return (
    <div style={{
      background: '#1e1e1e',
      borderRadius: '12px',
      border: '1px solid #333',
      marginBottom: '30px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 24px',
        borderBottom: '1px solid #333',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '17px',
          fontWeight: '700',
          color: '#fff',
          borderBottom: '2px solid #2CC275',
          paddingBottom: '4px',
          display: 'inline-block',
        }}>
          Lịch diễn
        </h3>

        {/* View mode toggle */}
        <div style={{
          display: 'flex',
          gap: '0',
          border: '1px solid #444',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              background: viewMode === 'list' ? '#333' : 'transparent',
              color: viewMode === 'list' ? '#fff' : '#888',
              border: 'none',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
          >
            <FaList size={12} />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              background: viewMode === 'calendar' ? '#333' : 'transparent',
              color: viewMode === 'calendar' ? '#fff' : '#888',
              border: 'none',
              borderLeft: '1px solid #444',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
          >
            <FaCalendarAlt size={12} />
          </button>
        </div>
      </div>

      {/* ===== CALENDAR VIEW ===== */}
      {viewMode === 'calendar' && (
        <div>
          {/* Month tabs with arrows */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #333',
            background: '#252525',
          }}>
            <button
              onClick={() => navigateMonth(-1)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#888'}
            >
              <FaChevronLeft />
            </button>
            
            <div style={{
              flex: 1,
              display: 'flex',
              overflow: 'auto',
              scrollBehavior: 'smooth',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}>
              {visibleMonths.map((m, idx) => (
                <MonthTab
                  key={idx}
                  month={m.month}
                  year={m.year}
                  count={m.schedules.length}
                  isActive={m.month === currentMonth && m.year === currentYear}
                  onClick={() => { setCurrentMonth(m.month); setCurrentYear(m.year); }}
                />
              ))}
            </div>

            <button
              onClick={() => navigateMonth(1)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#888'}
            >
              <FaChevronRight />
            </button>
          </div>

          {/* Day of week headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid #333',
            background: '#252525',
          }}>
            {DAYS_VN.map((day, i) => (
              <div key={i} style={{
                textAlign: 'center',
                padding: '12px 4px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ccc',
                letterSpacing: '0.5px',
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            padding: '12px',
            gap: '4px',
          }}>
            {calendarDays.map((dayInfo, idx) => (
              <CalendarDay
                key={idx}
                day={dayInfo.day}
                isCurrentMonth={dayInfo.isCurrentMonth}
                hasEvent={dayInfo.hasEvent}
                isToday={dayInfo.isToday}
                onClick={() => {
                  // Find the schedule for this date and switch to list view
                  const schedule = schedules.find(s => {
                    const sd = new Date(s.schedule_date);
                    return sd.getDate() === dayInfo.day &&
                      sd.getMonth() === dayInfo.date.getMonth() &&
                      sd.getFullYear() === dayInfo.date.getFullYear();
                  });
                  if (schedule) {
                    // Select the date and notify parent
                    const scheduleInfo = {
                      selected_date: schedule.schedule_date,
                      schedule_time: `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
                    };
                    if (onSelectDate) {
                      onSelectDate(scheduleInfo);
                    }
                    // Scroll to ticket section after a short delay for state to update
                    setTimeout(() => {
                      const ticketSection = document.getElementById('ticket-section');
                      if (ticketSection) {
                        ticketSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }, 100);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      {viewMode === 'list' && (
        <div>
          {schedules.map(schedule => (
            <ScheduleListItem
              key={schedule.id}
              schedule={schedule}
              tickets={tickets}
              event={event}
              isExpanded={expandedScheduleId === schedule.id}
              onToggle={() => setExpandedScheduleId(
                expandedScheduleId === schedule.id ? null : schedule.id
              )}
              onBuyTicket={handleBuyTicket}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default EventSchedule;
