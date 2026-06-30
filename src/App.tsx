/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PayrollProvider, usePayroll } from './context/PayrollContext';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { AttendanceTracker } from './components/AttendanceTracker';
import { PayrollGenerator } from './components/PayrollGenerator';
import { PayrollStats } from './components/PayrollStats';
import { Users, CalendarDays, ReceiptIndianRupee, BarChart3, Menu, X, Briefcase, ChevronRight, Activity, Trash2, Undo2, History, Lock, Eye, EyeOff, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabId = 'directory' | 'attendance' | 'payroll' | 'analytics';

function LoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVibrating, setIsVibrating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'Vardhmanpay@44' && password === 'ABAFV0462G1') {
      localStorage.setItem('payroll_mgmt_logged_in', 'true');
      onLoginSuccess();
    } else {
      setError('Aapka ID ya Password galat hai. Kripya sahi details darj karein.');
      setIsVibrating(true);
      setTimeout(() => setIsVibrating(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-4 antialiased">
      <motion.div
        animate={isVibrating ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
      >
        {/* Banner */}
        <div className="bg-indigo-600 px-6 py-6 border-b-4 border-black text-white flex items-center gap-4">
          <div className="h-12 w-12 bg-white/15 border-2 border-white/30 rounded-2xl flex items-center justify-center">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="font-black text-2xl tracking-tighter uppercase leading-none">PAY/ROLL.HUB</h2>
            <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 inline" /> SECURE GATEWAY ACCESS
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3 text-xs text-rose-800 font-bold leading-normal"
            >
              ⚠️ {error}
            </motion.div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Secure User ID</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="Enter User ID"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-black rounded-xl text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 select-none font-bold text-sm">@</span>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Secret Passkey</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••••"
                required
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border-2 border-black rounded-xl text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition"
              />
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-black transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-6 border-2 border-black bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 mt-2"
          >
            <LogIn className="h-4 w-4" />
            Authenticate & Enter
          </button>
        </form>

        {/* Footer */}
        <div className="bg-slate-50 border-t-2 border-slate-100 p-4 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Enterprise Grade Security Active
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function PayrollAppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('payroll_mgmt_logged_in') === 'true';
  });
  const [activeTab, setActiveTab] = useState<TabId>('directory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { deletedLogs, restoreEmployee, clearDeletedLogs } = usePayroll();

  const tabs = [
    { id: 'directory', label: 'Employee Directory', shortLabel: 'Directory', icon: Users, description: 'Manage personnel & salaries' },
    { id: 'attendance', label: 'Attendance Tracker', shortLabel: 'Attendance', icon: CalendarDays, description: 'Punch logs & grace periods' },
    { id: 'payroll', label: 'Payroll Ledger', shortLabel: 'Payroll', icon: ReceiptIndianRupee, description: 'Generate monthly payouts' },
    { id: 'analytics', label: 'Analytics & Insights', shortLabel: 'Analytics', icon: BarChart3, description: 'Visual stats & trends' },
  ];

  const activeTabDetails = tabs.find((t) => t.id === activeTab) || tabs[0];

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'directory':
        return <EmployeeDashboard />;
      case 'attendance':
        return <AttendanceTracker />;
      case 'payroll':
        return <PayrollGenerator />;
      case 'analytics':
        return <PayrollStats />;
      default:
        return <EmployeeDashboard />;
    }
  };

  if (!isLoggedIn) {
    return <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 font-sans flex flex-col lg:flex-row antialiased">
        
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b-2 border-black sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2">
            <span className="font-black text-2xl tracking-tighter text-indigo-600">PAY/ROLL.</span>
            <span className="text-[9px] font-bold bg-black text-white px-1.5 py-0.5 rounded uppercase tracking-wider">HUB</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 border-2 border-black rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Sidebar Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r-4 border-black p-6 flex flex-col justify-between transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:h-screen lg:top-0 shrink-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="space-y-8">
            {/* Sidebar Branding */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 bg-indigo-600 border-2 border-black rounded-lg flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-black text-3xl tracking-tighter text-indigo-600 block leading-none">PAY/ROLL.</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">Enterprise Hub</span>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 border-2 border-black rounded-md hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Cycle Box (Polished high-contrast indicator) */}
            <div className="bg-amber-100 border-2 border-black p-4 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-amber-800 tracking-wider uppercase block">CURRENT RUNTIME CYCLE</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-extrabold text-black uppercase tracking-tight">JUNE 2026</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-black text-emerald-400 px-2 py-0.5 rounded-full uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block px-1 mb-3">WORKSPACE NAV</span>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as TabId);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                      isActive
                        ? 'bg-indigo-600 text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-slate-700 border-transparent hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg border ${isActive ? 'bg-indigo-700 border-indigo-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tight">{tab.shortLabel}</div>
                        <div className={`text-[10px] ${isActive ? 'text-indigo-200' : 'text-slate-400'} leading-none mt-0.5`}>{tab.description}</div>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 opacity-50 transition-transform ${isActive ? 'translate-x-1 opacity-100' : ''}`} />
                  </button>
                );
              })}
            </nav>

            {/* Deletion Log Tracker */}
            <div className="space-y-3 pt-4 border-t-2 border-dashed border-slate-200">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-rose-600 tracking-widest uppercase flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5 animate-pulse" />
                  Deleted Logs
                </span>
                {deletedLogs.length > 0 && (
                  <button
                    onClick={clearDeletedLogs}
                    className="text-[9px] font-extrabold text-slate-400 hover:text-slate-600 uppercase cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {deletedLogs.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-[10px] text-slate-400 font-semibold italic">
                    No recently deleted employees
                  </div>
                ) : (
                  deletedLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between text-[11px] group transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] font-bold text-rose-700 bg-rose-100 px-1 rounded shrink-0">
                            {log.id}
                          </span>
                          <span className="font-black text-slate-950 truncate block">
                            {log.name}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          Removed at {log.deletedAt} ({log.type})
                        </span>
                      </div>
                      
                      <button
                        onClick={() => restoreEmployee(log.id)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition shrink-0 ml-1.5"
                        title="Restore Employee to directory"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
                {deletedLogs.length > 5 && (
                  <div className="text-center text-[9px] text-slate-400 font-bold">
                    + {deletedLogs.length - 5} more entries
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="border-t-2 border-slate-100 pt-6 space-y-3">
            <button
              onClick={() => {
                localStorage.removeItem('payroll_mgmt_logged_in');
                setIsLoggedIn(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-black rounded-xl font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out Securely
            </button>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Live Workspace
              </span>
              <span>Port 3000</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold tracking-tight">© 2026 Payroll Hub. Built with React & Tailwind CSS.</p>
          </div>
        </aside>

        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div 
            onClick={() => setMobileMenuOpen(false)} 
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#fafbfc]">
          {/* Top Banner / Breadcrumb block */}
          <section className="bg-white border-b-4 border-black p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_4px_0px_0px_rgba(0,0,0,0.03)] shrink-0">
            <div>
              <span className="text-xs font-black tracking-widest text-indigo-600 uppercase block mb-1">
                Payroll Management System
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase text-black">
                {activeTabDetails.label}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right hidden sm:block">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">LOGGED IN AS</span>
                <span className="text-xs font-black uppercase">Vardhmanpay</span>
              </div>
              <div className="h-10 w-10 rounded-full border-2 border-black bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                VP
              </div>
            </div>
          </section>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                {renderActiveContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
  );
}

export default function App() {
  return (
    <PayrollProvider>
      <PayrollAppContent />
    </PayrollProvider>
  );
}

