import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import {
  ShieldCheck,
  FileText,
  HeartPulse,
  Video,
  PlusCircle,
  CheckCircle2,
  Blocks,
  ShieldAlert,
  FileSearch,
  FileCheck2,
  User,
  Stethoscope,
  LogOut,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, quickLogin, logout } = useAuth();

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as UserRole;
    await quickLogin(role);
    navigate(`/${role.toLowerCase()}`);
  };

  // Dynamic links depending on active role
  const getRoleNavItems = () => {
    if (!user) {
      return [
        { label: 'Login', path: '/login', icon: User }
      ];
    }

    const items: Array<{ label: string; path: string; icon: any }> = [];

    // Role-specific primary dashboard
    items.push({
      label: `${user.role} Dashboard`,
      path: `/${user.role.toLowerCase()}`,
      icon: LayoutDashboard
    });

    if (user.role === 'DOCTOR') {
      items.push({ label: 'Vitals & Flags', path: '/vitals/demo-123', icon: HeartPulse });
      items.push({ label: 'Issue RX', path: '/prescriptions/new', icon: PlusCircle });
      items.push({ label: 'Prescriptions', path: '/prescriptions', icon: FileText });
    } else if (user.role === 'PATIENT') {
      items.push({ label: 'Consultations', path: '/', icon: Video });
      items.push({ label: 'Prescriptions', path: '/prescriptions', icon: FileText });
    } else if (user.role === 'NURSE') {
      items.push({ label: 'Capture Vitals', path: '/nurse', icon: HeartPulse });
      items.push({ label: 'Consultations', path: '/', icon: Video });
    } else if (user.role === 'ADMIN') {
      items.push({ label: 'Compliance Hub', path: '/compliance', icon: ShieldAlert });
      items.push({ label: 'Audit Chain', path: '/integrity', icon: Blocks });
      items.push({ label: 'Forensics Studio', path: '/investigation', icon: FileSearch });
    }

    // Always provide quick access to verification tools
    items.push({ label: 'Verify RX', path: '/prescriptions/verify', icon: CheckCircle2 });
    items.push({ label: 'Verify Report', path: '/investigation/verify', icon: FileCheck2 });

    return items;
  };

  const navItems = getRoleNavItems();

  const roleColors: Record<UserRole, string> = {
    DOCTOR: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    PATIENT: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
    NURSE: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    ADMIN: 'text-purple-400 border-purple-500/40 bg-purple-500/10'
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={user ? `/${user.role.toLowerCase()}` : '/'} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-transparent">
                TeleMedSecure
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-cyan-400 font-semibold -mt-1">
                Zero-Knowledge Medical Platform
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center space-x-1 sm:space-x-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Role Switcher & User Profile */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1.5 rounded-2xl shadow-inner">
                <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">Role:</span>
                <select
                  value={user.role}
                  onChange={handleRoleChange}
                  className={`text-xs font-mono font-bold rounded-lg px-2 py-1 border transition focus:outline-none cursor-pointer ${
                    roleColors[user.role]
                  }`}
                  title="Switch identity role for testing"
                >
                  <option value="DOCTOR">🩺 DOCTOR</option>
                  <option value="PATIENT">👤 PATIENT</option>
                  <option value="NURSE">🩹 NURSE</option>
                  <option value="ADMIN">🛡️ ADMIN</option>
                </select>

                <div className="hidden md:flex flex-col text-left pl-1">
                  <span className="text-xs font-semibold text-white leading-tight">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono leading-tight">
                    {user.email}
                  </span>
                </div>

                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/60 rounded-lg transition ml-1"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
