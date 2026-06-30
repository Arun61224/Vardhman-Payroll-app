import React, { useState, useMemo } from 'react';
import { usePayroll } from '../context/PayrollContext';
import { calculateMonthlySummary, formatReadableDate } from '../utils/payroll';
import { MonthlyPayrollSummary, Employee, DayPayrollDetails } from '../types';
import { Search, Filter, IndianRupee, FileText, Calendar, Download, Printer, X, Clock, HelpCircle, Star, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayrollGenerator: React.FC = () => {
  const { employees, attendanceRecords, activeMonth, activeYear, setActiveMonth, setActiveYear } = usePayroll();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Staff' | 'Labour'>('All');
  const [selectedSummary, setSelectedSummary] = useState<MonthlyPayrollSummary | null>(null);

  // Generate payroll summaries for all employees based on currently selected month & year
  const payrollSummaries = useMemo(() => {
    return employees.map((emp) => calculateMonthlySummary(emp, attendanceRecords, activeYear, activeMonth));
  }, [employees, attendanceRecords, activeYear, activeMonth]);

  // Filter and search
  const filteredSummaries = useMemo(() => {
    return payrollSummaries.filter((summary) => {
      const matchesSearch = summary.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            summary.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'All' || summary.employeeType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [payrollSummaries, searchTerm, typeFilter]);

  // High-level metrics
  const totalWagesPayable = useMemo(() => {
    return payrollSummaries.reduce((acc, s) => acc + s.finalPayableSalary, 0);
  }, [payrollSummaries]);

  const totalDeductions = useMemo(() => {
    return payrollSummaries.reduce((acc, s) => acc + s.totalLateDeductions + s.leaveDeductions, 0);
  }, [payrollSummaries]);

  const totalOvertimePaid = useMemo(() => {
    return payrollSummaries.reduce((acc, s) => acc + s.totalOvertimeBonuses, 0);
  }, [payrollSummaries]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Title & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Payroll Ledger</h1>
          <p className="text-sm text-slate-500">Calculate gross wages, late deductions, leave ceilings, and print corporate statements.</p>
        </div>

        {/* Month / Year Selectors */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-xs">
          <Calendar className="h-4 w-4 text-slate-400 ml-2" />
          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(Number(e.target.value))}
            className="text-xs font-semibold text-slate-700 focus:outline-none bg-transparent cursor-pointer py-1"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>

          <span className="text-slate-300">|</span>

          <select
            value={activeYear}
            onChange={(e) => setActiveYear(Number(e.target.value))}
            className="text-xs font-semibold text-slate-700 focus:outline-none bg-transparent cursor-pointer py-1 pr-2"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Aggregate Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Net Payroll */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between border border-slate-850 shadow-md">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-450 uppercase tracking-wider">Total Net Payable Wages</span>
            <h3 className="text-2xl font-bold">₹{totalWagesPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <span className="text-[10px] text-slate-400">Net payout for {MONTH_NAMES[activeMonth]} {activeYear}</span>
          </div>
          <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 text-emerald-400">
            <IndianRupee className="h-6 w-6" />
          </div>
        </div>

        {/* Total Penalties Deducted */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Penalties Deducted</span>
            <h3 className="text-2xl font-bold text-rose-600">₹{totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <span className="text-xs text-slate-500">Late entry + excessive leaves</span>
          </div>
          <div className="h-12 w-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 border border-rose-100/50">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        {/* Total OT Paid */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Overtime Bonuses</span>
            <h3 className="text-2xl font-bold text-emerald-600">₹{totalOvertimePaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <span className="text-xs text-slate-500">Flat ₹100 for shift days &ge; 12h</span>
          </div>
          <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100/50">
            <Star className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Rules Indicator Banner */}
      <div className="bg-indigo-50/50 border border-indigo-100/40 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-indigo-950/90 font-medium">
        <div className="space-y-0.5">
          <span className="text-indigo-600 font-bold uppercase tracking-wide text-[10px] block">Wage Formulation</span>
          Daily pay calculated as Monthly Basic / 30. Standard Hourly wage equals Daily pay / 9.
        </div>
        <div className="space-y-0.5 border-t md:border-t-0 md:border-l border-indigo-100/50 md:pl-4 pt-2 md:pt-0">
          <span className="text-indigo-600 font-bold uppercase tracking-wide text-[10px] block">Leave ceilings</span>
          Every employee is granted 1.5 days of paid leaves. Excess leaves trigger full 1-day pay deduction.
        </div>
        <div className="space-y-0.5 border-t md:border-t-0 md:border-l border-indigo-100/50 md:pl-4 pt-2 md:pt-0">
          <span className="text-indigo-600 font-bold uppercase tracking-wide text-[10px] block">Overtime (OT)</span>
          Shift time &ge; 12 hours qualifies for ₹100 bonus. Sundays are paid hourly (Staff) or as full days (Labour &ge; 7 hours).
        </div>
      </div>

      {/* Filter and Table Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-700"
            />
          </div>

          <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-end">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            {(['All', 'Staff', 'Labour'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  typeFilter === t
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Core Ledger Table */}
        {filteredSummaries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-semibold">No payroll reports generated</p>
            <p className="text-xs mt-1">No employees match your search or category filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Salary</th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Status</th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Penalties (Late + Leaves)</th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bonuses & OT</th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Take Home</th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSummaries.map((s) => {
                  return (
                    <tr key={s.employeeId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800">{s.employeeName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400">{s.employeeId}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            s.employeeType === 'Staff' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {s.employeeType}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">
                        ₹{s.basicSalary.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3 text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{s.daysPresent}</span>
                            <span className="text-slate-400 block text-[10px]">Present</span>
                          </div>
                          <div className="border-l border-slate-200 h-5 self-center" />
                          <div>
                            <span className="font-bold text-slate-800">{s.daysLeave}</span>
                            <span className="text-slate-400 block text-[10px]">Leaves</span>
                          </div>
                          <div className="border-l border-slate-200 h-5 self-center" />
                          <div>
                            <span className={`font-bold ${s.daysAbsent > 0 ? 'text-rose-600' : 'text-slate-850'}`}>{s.daysAbsent}</span>
                            <span className="text-slate-400 block text-[10px]">Absent</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          {s.totalLateDeductions > 0 && (
                            <div className="text-xs font-medium text-rose-600 flex items-center gap-1">
                              Late: -₹{s.totalLateDeductions.toFixed(0)}
                            </div>
                          )}
                          {s.leaveDeductions > 0 && (
                            <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                              Leaves/Absent: -₹{s.leaveDeductions.toFixed(0)}
                            </div>
                          )}
                          {s.totalLateDeductions === 0 && s.leaveDeductions === 0 && (
                            <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              ₹0.00 (No Penalties)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          {s.totalOvertimeBonuses > 0 && (
                            <div className="text-xs font-bold text-purple-700">
                              OT Bonus: +₹{s.totalOvertimeBonuses}
                            </div>
                          )}
                          {s.dailyDetails.some(d => d.isSunday && d.dailyWage > 0) && (
                            <div className="text-[10px] font-bold text-amber-600">
                              Sunday OT Included
                            </div>
                          )}
                          {s.totalOvertimeBonuses === 0 && !s.dailyDetails.some(d => d.isSunday && d.dailyWage > 0) && (
                            <div className="text-xs text-slate-400 italic">None</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 block w-fit">
                            ₹{Math.round(s.netTakeHome).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 block pl-1">
                            Gross: ₹{Math.round(s.finalPayableSalary).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedSummary(s)}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1 ml-auto"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Wageslip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Corporate Statement / Payslip Detailed Modal */}
      <AnimatePresence>
        {selectedSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSummary(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Payslip Card Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold tracking-tight text-sm uppercase">Wageslip & Performance Ledger</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition"
                    title="Print / Export Statement"
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => setSelectedSummary(null)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Statement Body */}
              <div className="p-6 overflow-y-auto space-y-6 printable-area">
                {/* Corporate Branding Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-100 pb-5 gap-4">
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-indigo-600">Dynamic Payroll Solutions Ltd.</h2>
                    <p className="text-[10px] text-slate-400 font-mono">ID: SEC-REG-99104 · NEW DELHI, IN</p>
                    <p className="text-xs text-slate-600">Employee contract earnings record for <strong>{MONTH_NAMES[activeMonth]} {activeYear}</strong></p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-100">PAYSLIP GENERATED</span>
                    <p className="text-xs text-slate-500 font-mono">Date: {new Date().toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                {/* Personal employee metadata card */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Employee Name</span>
                    <strong className="text-slate-800 text-sm">{selectedSummary.employeeName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Staff Type</span>
                    <span className={`inline-block text-xs font-bold text-slate-700 ${
                      selectedSummary.employeeType === 'Staff' ? 'text-indigo-600' : 'text-amber-600'
                    }`}>{selectedSummary.employeeType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Monthly Base Salary</span>
                    <strong className="text-slate-800 text-sm">₹{selectedSummary.basicSalary.toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Derived Hourly Wage</span>
                    <strong className="text-slate-800 text-sm font-mono">₹{selectedSummary.hourlyWage.toFixed(2)}/h</strong>
                  </div>
                </div>

                {/* Left/Right Balance breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Ledger Income Component */}
                  <div className="space-y-2 border border-slate-100 p-4 rounded-2xl bg-white">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Earnings Breakdowns</h4>
                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-600">Contract Base Salary</span>
                        <span className="font-semibold text-slate-800">₹{selectedSummary.basicSalary.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-600">Overtime Flat Bonuses</span>
                        <span className="font-semibold text-emerald-600">+₹{selectedSummary.totalOvertimeBonuses}</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-600">Sunday Overtime Pay (Extra)</span>
                        {/* Calculate Sunday pay */}
                        <span className="font-semibold text-emerald-600">
                          +₹{selectedSummary.dailyDetails
                            .filter(d => d.isSunday && d.dailyWage > 0)
                            .reduce((acc, d) => acc + d.dailyWage, 0)
                            .toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ledger Deductions Component */}
                  <div className="space-y-2 border border-slate-100 p-4 rounded-2xl bg-white">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Penalties & Statutory Deductions</h4>
                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-600">Late Entry Penalty</span>
                        <span className="font-semibold text-rose-600">-₹{selectedSummary.totalLateDeductions.toFixed(0)}</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-600">Excess Leaves & Absence</span>
                        <span className="font-semibold text-rose-600">-₹{selectedSummary.leaveDeductions.toFixed(0)}</span>
                      </div>
                      {selectedSummary.esiDeduction > 0 && (
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-600">ESI Deduction (0.75%)</span>
                          <span className="font-semibold text-rose-600">-₹{selectedSummary.esiDeduction.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedSummary.pfDeduction > 0 && (
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-600">PF Deduction (12.0%)</span>
                          <span className="font-semibold text-rose-600">-₹{selectedSummary.pfDeduction.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedSummary.lwfDeduction > 0 && (
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-600">LWF Deduction (0.2%, max ₹35)</span>
                          <span className="font-semibold text-rose-600">-₹{selectedSummary.lwfDeduction.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500 font-bold">Total Deductions</span>
                        <span className="font-bold text-rose-600">
                          -₹{(
                            selectedSummary.totalLateDeductions +
                            selectedSummary.leaveDeductions +
                            selectedSummary.esiDeduction +
                            selectedSummary.pfDeduction +
                            selectedSummary.lwfDeduction
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Net Calculation Highlight */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">Net Take Home Salary</h3>
                    <p className="text-[10px] text-slate-400 font-medium">After late penalties & statutory coverages</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-black text-emerald-400">₹{Math.round(selectedSummary.netTakeHome).toLocaleString('en-IN')}</h2>
                    <span className="text-[10px] font-mono text-slate-350">
                      Gross: ₹{Math.round(selectedSummary.finalPayableSalary).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Day-by-day attendance ledger detail */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Detailed Daily Timecards Log</h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 sticky top-0 border-b border-slate-100">
                          <th className="py-2.5 px-4 font-bold text-slate-500">Date</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">Status</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">Punches</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">Duration</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">Late (M)</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">Deduction</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">OT Bonus</th>
                          <th className="py-2.5 px-4 font-bold text-slate-500">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSummary.dailyDetails.map((day) => (
                          <tr key={day.date} className={`hover:bg-slate-50/60 ${day.isSunday ? 'bg-amber-50/20' : ''}`}>
                            <td className="py-2.5 px-4 font-medium text-slate-700">{formatReadableDate(day.date)}</td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                day.status === 'Present'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : day.status === 'Absent'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {day.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                              {day.punchIn ? `${day.punchIn} - ${day.punchOut}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 font-medium">
                              {day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(1)}h` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-rose-600 font-mono font-medium">
                              {day.lateMinutes > 0 ? `${day.lateMinutes}m` : '0m'}
                            </td>
                            <td className="py-2.5 px-4 text-rose-600 font-mono font-medium">
                              {day.lateDeduction > 0 ? `-₹${day.lateDeduction.toFixed(0)}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-purple-700 font-bold font-mono">
                              {day.overtimeBonus > 0 ? `+₹${day.overtimeBonus}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 text-[10px]">{day.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sign-off footer */}
                <div className="pt-6 border-t border-dashed border-slate-200 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400">PREPARED BY</p>
                    <div className="border-b border-slate-300 w-28 h-5" />
                    <p className="text-[10px] text-slate-500 font-medium">Corporate HR Admin</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] text-slate-400">AUTHORIZED BY</p>
                    <div className="border-b border-slate-300 w-28 h-5 ml-auto" />
                    <p className="text-[10px] text-slate-500 font-medium">Finance Controller</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
