import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  Plus,
  User,
  Stethoscope,
  AlertCircle
} from 'lucide-react';

interface Consultation {
  id: string;
  scheduledAt: string;
  status: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function AppointmentScheduler() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchConsultations();
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/consultations`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConsultations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch consultations', e);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getConsultationsForDay = (date: Date) => {
    if (!date) return [];
    const dateStr = date.toDateString();
    return consultations.filter(c => new Date(c.scheduledAt).toDateString() === dateStr);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Calendar className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">Appointment Calendar</h1>
            </div>
            <p className="text-sm text-slate-400 ml-11">
              Schedule and manage your telemedicine consultations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
            >
              Today
            </button>
            <button
              onClick={() => navigate('/consultations/new')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>New Appointment</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-slate-800/80 rounded-3xl border border-slate-700/80 shadow-xl p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-400 uppercase py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={index} className="aspect-square" />;
                }

                const dayConsultations = getConsultationsForDay(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate?.toDateString() === date.toDateString();

                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className={`aspect-square rounded-xl p-2 transition relative ${
                      isToday
                        ? 'bg-blue-600/30 border-2 border-blue-500'
                        : isSelected
                        ? 'bg-slate-700 border-2 border-slate-500'
                        : 'bg-slate-900/50 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white mb-1">
                      {date.getDate()}
                    </div>
                    {dayConsultations.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {dayConsultations.slice(0, 2).map((c, i) => (
                          <div
                            key={i}
                            className="text-[9px] bg-blue-500/30 text-blue-200 px-1 rounded truncate"
                          >
                            {new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ))}
                        {dayConsultations.length > 2 && (
                          <div className="text-[9px] text-slate-400">
                            +{dayConsultations.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details */}
          <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 shadow-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : 'Select a date'}
              </span>
            </h3>

            {selectedDate ? (
              <div className="space-y-3">
                {getConsultationsForDay(selectedDate).length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <Calendar className="w-12 h-12 text-slate-500 mx-auto" />
                    <p className="text-sm text-slate-400">No appointments scheduled</p>
                    <button
                      onClick={() => navigate('/consultations/new')}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                    >
                      Schedule Appointment
                    </button>
                  </div>
                ) : (
                  getConsultationsForDay(selectedDate).map(c => (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-blue-400">
                          {new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-700 text-slate-300">
                          {c.status || 'SCHEDULED'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-white">
                          {c.patient.firstName} {c.patient.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => navigate(`/waiting-room/${c.id}`)}
                          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-1"
                        >
                          <Video className="w-3 h-3" />
                          <span>Start Call</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">
                Click on a date to view appointments
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
