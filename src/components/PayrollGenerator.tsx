import React, { useState, useMemo } from 'react';
import { usePayroll } from '../context/PayrollContext';
import { calculateMonthlySummary, formatReadableDate, formatHoursAndMinutes } from '../utils/payroll';
import { MonthlyPayrollSummary, Employee, DayPayrollDetails } from '../types';
import { Search, Filter, IndianRupee, FileText, Calendar, Download, Printer, X, Clock, HelpCircle, Star, AlertTriangle, ShieldCheck, SlidersHorizontal, Clipboard, CheckCircle2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayrollGenerator: React.FC = () => {
  const { 
    employees, 
    attendanceRecords, 
    activeMonth, 
    activeYear, 
    setActiveMonth, 
    setActiveYear,
    customLeaveDeductions,
    setCustomLeaveDeduction,
    customAdjustedHours,
    setCustomAdjustedHours,
    bulkSetCustomAdjustedHours,
    advances,
    setAdvance,
    bulkSetAdvances
  } = usePayroll();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Staff' | 'Labour'>('All');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isBulkAdjustOpen, setIsBulkAdjustOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<'table' | 'paste'>('table');
  const [pasteText, setPasteText] = useState('');

  const [isAdvancesOpen, setIsAdvancesOpen] = useState(false);
  const [localAdvances, setLocalAdvances] = useState<Record<string, number>>({});

  // Generate payroll summaries for all employees based on currently selected month & year
  const payrollSummaries = useMemo(() => {
    return employees.map((emp) => {
      const overrideKey = `${emp.id}-${activeYear}-${activeMonth}`;
      const overrideAmount = customLeaveDeductions[overrideKey];
      const overrideHours = customAdjustedHours[overrideKey];
      const advanceAmount = advances[overrideKey] || 0;
      return calculateMonthlySummary(emp, attendanceRecords, activeYear, activeMonth, overrideAmount, overrideHours, advanceAmount);
    });
  }, [employees, attendanceRecords, activeYear, activeMonth, customLeaveDeductions, customAdjustedHours, advances]);

  const selectedSummary = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return payrollSummaries.find((s) => s.employeeId === selectedEmployeeId) || null;
  }, [payrollSummaries, selectedEmployeeId]);

  const handleLeaveDeductionChange = (employeeId: string, amountStr: string) => {
    const val = amountStr === '' ? null : Number(amountStr);
    setCustomLeaveDeduction(employeeId, activeYear, activeMonth, val);
  };

  const handleAdjustedHoursChange = (employeeId: string, hoursStr: string) => {
    const val = hoursStr === '' ? null : Number(hoursStr);
    setCustomAdjustedHours(employeeId, activeYear, activeMonth, val);
  };

  const [localAdjustments, setLocalAdjustments] = useState<Record<string, number>>({});

  const handleOpenBulkAdjust = () => {
    const initial: Record<string, number> = {};
    employees.filter(emp => emp.type === 'Staff').forEach((emp) => {
      const key = `${emp.id}-${activeYear}-${activeMonth}`;
      initial[emp.id] = customAdjustedHours[key] || 0;
    });
    setLocalAdjustments(initial);
    setPasteText('');
    setBulkTab('table');
    setIsBulkAdjustOpen(true);
  };

  const handleLocalAdjustmentChange = (empId: string, val: number) => {
    setLocalAdjustments((prev) => ({
      ...prev,
      [empId]: val,
    }));
  };

  const handleSaveTableAdjustments = () => {
    const updates: Record<string, number | null> = {};
    employees.forEach((emp) => {
      if (emp.type === 'Staff') {
        const val = localAdjustments[emp.id];
        updates[emp.id] = val !== undefined && val !== 0 ? val : null;
      } else {
        updates[emp.id] = null; // Clear any old adjustments for Labour if any
      }
    });
    bulkSetCustomAdjustedHours(updates, activeYear, activeMonth);
    setIsBulkAdjustOpen(false);
  };

  const handleOpenAdvances = () => {
    const initial: Record<string, number> = {};
    employees.forEach((emp) => {
      const key = `${emp.id}-${activeYear}-${activeMonth}`;
      initial[emp.id] = advances[key] || 0;
    });
    setLocalAdvances(initial);
    setIsAdvancesOpen(true);
  };

  const handleLocalAdvanceChange = (empId: string, val: number) => {
    setLocalAdvances((prev) => ({
      ...prev,
      [empId]: val,
    }));
  };

  const handleSaveTableAdvances = () => {
    const updates: Record<string, number | null> = {};
    employees.forEach((emp) => {
      const val = localAdvances[emp.id];
      updates[emp.id] = val !== undefined && val !== 0 ? val : null;
    });
    bulkSetAdvances(updates, activeYear, activeMonth);
    setIsAdvancesOpen(false);
  };

  const downloadAdvanceTemplate = () => {
    const headers = ["Employee ID", "Employee Name", "Employee Type", "Advance Amount (INR)"];
    const rows = employees.map((emp) => {
      const overrideKey = `${emp.id}-${activeYear}-${activeMonth}`;
      const existingAmount = advances[overrideKey] || 0;
      return [
        emp.id,
        emp.name,
        emp.type,
        existingAmount
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(field => {
        const str = String(field ?? "");
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Advance_Template_${MONTH_NAMES[activeMonth]}_${activeYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdvanceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/);
      const updates: Record<string, number | null> = {};
      let parseCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        if (parts.length >= 4) {
          const empId = parts[0].trim().replace(/^"|"$/g, '');
          const amountStr = parts[3].trim().replace(/^"|"$/g, '');
          const amount = parseFloat(amountStr);

          const exists = employees.some(emp => emp.id === empId);
          if (exists && !isNaN(amount)) {
            updates[empId] = amount;
            parseCount++;
          } else {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }

      if (parseCount > 0) {
        bulkSetAdvances(updates, activeYear, activeMonth);
        alert(`Successfully uploaded advances for ${parseCount} employee(s).${errorCount > 0 ? ` (${errorCount} rows ignored or invalid)` : ''}`);
        setLocalAdvances((prev) => {
          const fresh = { ...prev };
          Object.entries(updates).forEach(([empId, amt]) => {
            fresh[empId] = amt || 0;
          });
          return fresh;
        });
      } else {
        alert('Could not find any valid employee ID and advance amounts in the file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parsedPreview = useMemo(() => {
    if (!pasteText.trim()) return [];
    
    const lines = pasteText.split('\n');
    const results: { 
      lineNum: number; 
      originalLine: string; 
      matchedEmployee?: Employee; 
      hours?: number; 
      status: 'matched' | 'not-found' | 'invalid' 
    }[] = [];
    
    lines.forEach((line, index) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      
      const numberMatches = [...cleanLine.matchAll(/(-?\d+(?:\.\d+)?)/g)];
      
      if (numberMatches.length === 0) {
        results.push({
          lineNum: index + 1,
          originalLine: cleanLine,
          status: 'invalid'
        });
        return;
      }
      
      const lastMatch = numberMatches[numberMatches.length - 1];
      const hoursVal = parseFloat(lastMatch[0]);
      
      const hoursStrIndex = cleanLine.lastIndexOf(lastMatch[0]);
      const searchTermPart = cleanLine.substring(0, hoursStrIndex).trim().replace(/[,;\t]+$/, '').trim();
      
      if (!searchTermPart) {
        results.push({
          lineNum: index + 1,
          originalLine: cleanLine,
          status: 'invalid'
        });
        return;
      }
      
      const matched = employees.find((emp) => {
        const term = searchTermPart.toLowerCase();
        return (
          emp.id.toLowerCase() === term ||
          emp.name.toLowerCase() === term ||
          emp.name.toLowerCase().includes(term) ||
          term.includes(emp.id.toLowerCase())
        );
      });
      
      if (matched) {
        if (matched.type === 'Staff') {
          results.push({
            lineNum: index + 1,
            originalLine: cleanLine,
            matchedEmployee: matched,
            hours: hoursVal,
            status: 'matched'
          });
        } else {
          // Labour hours adjustment is ignored/disabled as they are paid on standard day/OT basis
          results.push({
            lineNum: index + 1,
            originalLine: cleanLine,
            status: 'invalid'
          });
        }
      } else {
        results.push({
          lineNum: index + 1,
          originalLine: cleanLine,
          hours: hoursVal,
          status: 'not-found'
        });
      }
    });
    
    return results;
  }, [pasteText, employees]);

  const handleApplyPaste = () => {
    const updates: Record<string, number | null> = {};
    parsedPreview.forEach((item) => {
      if (item.status === 'matched' && item.matchedEmployee && item.hours !== undefined) {
        updates[item.matchedEmployee.id] = item.hours;
      }
    });
    
    bulkSetCustomAdjustedHours(updates, activeYear, activeMonth);
    setIsBulkAdjustOpen(false);
  };

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

  const totalNetTakeHome = useMemo(() => {
    return payrollSummaries.reduce((acc, s) => acc + s.netTakeHome, 0);
  }, [payrollSummaries]);

  const totalAdvancesDeducted = useMemo(() => {
    return payrollSummaries.reduce((acc, s) => acc + (s.advanceAmount || 0), 0);
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

  const exportToExcel = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Employee Type",
      "Basic Salary (INR)",
      "Days Present",
      "Days Leave",
      "Days Absent",
      "Total Late Minutes",
      "Late Deductions (INR)",
      "Underwork Deductions (INR)",
      "Leave/Absent Deductions (INR)",
      "Overtime Bonuses (INR)",
      "Final Payable Salary (INR)",
      "ESI Deduction (INR)",
      "PF Deduction (INR)",
      "LWF Deduction (INR)",
      "Advance Deductions (INR)",
      "Net Take Home (INR)"
    ];

    const rows = payrollSummaries.map(s => [
      s.employeeId,
      s.employeeName,
      s.employeeType,
      s.basicSalary,
      s.daysPresent,
      s.daysLeave,
      s.daysAbsent,
      s.totalLateMinutes,
      Math.round(s.totalLateDeductions),
      Math.round(s.totalUnderworkDeductions || 0),
      Math.round(s.leaveDeductions),
      s.totalOvertimeBonuses,
      Math.round(s.finalPayableSalary),
      Math.round(s.esiDeduction),
      Math.round(s.pfDeduction),
      Math.round(s.lwfDeduction),
      Math.round(s.advanceAmount || 0),
      Math.round(s.netTakeHome)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(field => {
        const str = String(field ?? "");
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Payroll_Report_${MONTH_NAMES[activeMonth]}_${activeYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDetailedToExcel = () => {
    if (!selectedSummary) return;

    const metadata = [
      ["Employee Name", selectedSummary.employeeName],
      ["Employee ID", selectedSummary.employeeId],
      ["Employee Type", selectedSummary.employeeType],
      ["Period", `${MONTH_NAMES[activeMonth]} ${activeYear}`],
      ["Monthly Base Salary", `INR ${selectedSummary.basicSalary}`],
      ["Derived Hourly Wage", `INR ${selectedSummary.hourlyWage.toFixed(2)}/h`],
      ["Net Take Home", `INR ${Math.round(selectedSummary.netTakeHome)}`],
      [],
      ["DETAILED DAILY TIMECARDS LOG"],
      [
        "Date",
        "Status",
        "Punch In",
        "Punch Out",
        "Duration",
        "Late (Minutes)",
        "Late Deduction (INR)",
        "Underwork Deduction (INR)",
        "OT Bonus (INR)",
        "Net Pay (INR)",
        "Explanation"
      ]
    ];

    const rows = selectedSummary.dailyDetails.map(day => [
      formatReadableDate(day.date),
      day.status,
      day.punchIn || "—",
      day.punchOut || "—",
      day.hoursWorked > 0 ? formatHoursAndMinutes(day.hoursWorked) : "—",
      day.lateMinutes,
      Math.round(day.lateDeduction),
      Math.round(day.underworkDeduction || 0),
      day.overtimeBonus,
      Math.round(day.netPay ?? 0),
      day.explanation
    ]);

    const csvContent = [
      ...metadata.map(row => row.map(field => {
        const str = String(field ?? "");
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")),
      ...rows.map(row => row.map(field => {
        const str = String(field ?? "");
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedSummary.employeeName.replace(/\s+/g, "_")}_Attendance_Report_${MONTH_NAMES[activeMonth]}_${activeYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Payroll Ledger</h1>
          <p className="text-sm text-slate-500">Calculate gross wages, late deductions, leave ceilings, and print corporate statements.</p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
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

          {/* Export to Excel Button */}
          <button
            onClick={exportToExcel}
            className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all rounded-xl flex items-center gap-1.5 shadow-xs border border-emerald-500 cursor-pointer"
            title="Download payroll report in Excel format"
          >
            <Download className="h-3.5 w-3.5" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Aggregate Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Net Payroll */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between border border-slate-850 shadow-md">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-450 uppercase tracking-wider">Total Net Take-Home</span>
            <h3 className="text-2xl font-bold">₹{totalNetTakeHome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <span className="text-[10px] text-slate-400">Gross Payable: ₹{totalWagesPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 text-emerald-400">
            <IndianRupee className="h-6 w-6" />
          </div>
        </div>

        {/* Total Penalties Deducted */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Penalties & Advances</span>
            <h3 className="text-2xl font-bold text-rose-600">₹{(totalDeductions + totalAdvancesDeducted).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <span className="text-xs text-slate-500">Late/Leave: ₹{totalDeductions.toLocaleString('en-IN')} | Adv: ₹{totalAdvancesDeducted.toLocaleString('en-IN')}</span>
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
          Staff is granted 1.5 days of paid leaves. Labour has no paid leaves (0 days). Excess leaves trigger full 1-day pay deduction.
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

          <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-end flex-wrap">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            {(['All', 'Staff', 'Labour'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  typeFilter === t
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={handleOpenBulkAdjust}
              className="px-3 py-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              title="Bulk Adjust Hours for All Employees"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Bulk Adjust Hours
            </button>
            <button
              onClick={handleOpenAdvances}
              className="px-3 py-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              title="Manage Advances (Upload/Download Template)"
            >
              <IndianRupee className="h-3.5 w-3.5" />
              Advances
            </button>
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
                          {s.advanceAmount !== undefined && s.advanceAmount > 0 && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded block w-fit">
                              Advance: -₹{s.advanceAmount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedEmployeeId(s.employeeId)}
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
              onClick={() => setSelectedEmployeeId(null)}
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
                    onClick={exportDetailedToExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
                    title="Export Detailed Timesheet to Excel"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer"
                    title="Print / Export Statement"
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => setSelectedEmployeeId(null)}
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
                      {selectedSummary.employeeType === 'Staff' && selectedSummary.adjustedHours !== undefined && selectedSummary.adjustedHours !== 0 && (
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Hours Adjustment ({selectedSummary.adjustedHours > 0 ? '+' : ''}{selectedSummary.adjustedHours}h)</span>
                          <span className={`font-semibold ${selectedSummary.adjustedHoursPay >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {selectedSummary.adjustedHoursPay >= 0 ? '+' : ''}₹{selectedSummary.adjustedHoursPay.toFixed(2)}
                          </span>
                        </div>
                      )}
                      
                      {selectedSummary.employeeType === 'Staff' && (
                        <div className="bg-indigo-50/50 p-2.5 mt-2 rounded-xl border border-indigo-100 flex flex-col gap-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-indigo-900 font-medium">Adjust Hours (Add/Deduct):</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.5"
                                placeholder="e.g. 8, -4, 12"
                                value={selectedSummary.adjustedHours || ''}
                                onChange={(e) => handleAdjustedHoursChange(selectedSummary.employeeId, e.target.value)}
                                className="w-24 px-1.5 py-0.5 text-right font-semibold text-indigo-950 bg-white border border-indigo-200 rounded-md focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                              />
                              {selectedSummary.adjustedHours !== 0 && (
                                <button
                                  onClick={() => setCustomAdjustedHours(selectedSummary.employeeId, activeYear, activeMonth, null)}
                                  className="p-0.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition"
                                  title="Reset adjustment"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 pt-1 border-t border-indigo-100/50">
                            <span className="text-slate-400 text-[10px]">Presets:</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleAdjustedHoursChange(selectedSummary.employeeId, '4')}
                                className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-100/70 hover:bg-indigo-100 text-indigo-700 rounded-md transition"
                              >
                                +4h (0.5d)
                              </button>
                              <button
                                onClick={() => handleAdjustedHoursChange(selectedSummary.employeeId, '8')}
                                className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-100/70 hover:bg-indigo-100 text-indigo-700 rounded-md transition"
                              >
                                +8h (1.5d/1d)
                              </button>
                              <button
                                onClick={() => handleAdjustedHoursChange(selectedSummary.employeeId, '12')}
                                className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-100/70 hover:bg-indigo-100 text-indigo-700 rounded-md transition"
                              >
                                +12h (1.5d)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
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
                      {selectedSummary.totalUnderworkDeductions !== undefined && selectedSummary.totalUnderworkDeductions > 0 && (
                        <div className="py-2 flex items-center justify-between">
                          <span className="text-slate-600">Underwork Penalty (Half/Short Day)</span>
                          <span className="font-semibold text-rose-600">-₹{selectedSummary.totalUnderworkDeductions.toFixed(0)}</span>
                        </div>
                      )}
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
                      {selectedSummary.advanceAmount !== undefined && selectedSummary.advanceAmount > 0 && (
                        <div className="py-2 flex items-center justify-between font-medium text-amber-700 bg-amber-50/50 px-2 rounded-lg my-1">
                          <span className="flex items-center gap-1 font-semibold">
                            Advance Salary Recouped
                          </span>
                          <span className="font-bold">-₹{selectedSummary.advanceAmount.toFixed(0)}</span>
                        </div>
                      )}
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-500 font-bold">Total Deductions</span>
                        <span className="font-bold text-rose-600">
                          -₹{(
                            selectedSummary.totalLateDeductions +
                            (selectedSummary.totalUnderworkDeductions || 0) +
                            selectedSummary.leaveDeductions +
                            selectedSummary.esiDeduction +
                            selectedSummary.pfDeduction +
                            selectedSummary.lwfDeduction +
                            (selectedSummary.advanceAmount || 0)
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
                          <th className="py-2.5 px-4 font-bold text-slate-500">Net Pay</th>
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
                              {day.hoursWorked > 0 ? (
                                <div className="space-y-0.5">
                                  <div>{formatHoursAndMinutes(day.hoursWorked)}</div>
                                  {day.actualWorkingHours !== undefined && day.actualWorkingHours !== day.hoursWorked && (
                                    <div className="text-[10px] text-slate-400 font-normal">({formatHoursAndMinutes(day.actualWorkingHours)} net)</div>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-rose-600 font-mono font-medium">
                              {day.lateMinutes > 0 ? `${day.lateMinutes}m` : '0m'}
                            </td>
                            <td className="py-2.5 px-4 text-rose-600 font-mono font-medium">
                              {day.lateDeduction > 0 || (day.underworkDeduction && day.underworkDeduction > 0) ? (
                                <div className="space-y-0.5 text-left">
                                  {day.lateDeduction > 0 && (
                                    <div title="Late Penalty">-₹{day.lateDeduction.toFixed(0)} <span className="text-[10px] text-slate-400">(Late)</span></div>
                                  )}
                                  {day.underworkDeduction && day.underworkDeduction > 0 ? (
                                    <div title="Underwork Penalty" className="text-amber-700">-₹{day.underworkDeduction.toFixed(0)} <span className="text-[10px] text-amber-500">(Under)</span></div>
                                  ) : null}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-purple-700 font-bold font-mono">
                              {day.overtimeBonus > 0 ? `+₹${day.overtimeBonus}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-emerald-600 font-bold font-mono">
                              ₹{day.netPay !== undefined ? day.netPay.toFixed(0) : '0'}
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

        {isBulkAdjustOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-6 border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden text-slate-800"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                    Bulk Adjust Hours
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Directly adjust payable hours for all employees in {MONTH_NAMES[activeMonth]} {activeYear}. (e.g., 1 day = 8 hrs, 1.5 days = 12 hrs)
                  </p>
                </div>
                <button
                  onClick={() => setIsBulkAdjustOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs Switcher */}
              <div className="flex border-b border-slate-100 my-4 p-1 bg-slate-50 rounded-xl">
                <button
                  onClick={() => setBulkTab('table')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    bulkTab === 'table'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Quick Table Editor
                </button>
                <button
                  onClick={() => setBulkTab('paste')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    bulkTab === 'paste'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Paste from Excel / Text
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
                {bulkTab === 'table' ? (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="p-3 font-semibold text-slate-500">Employee</th>
                          <th className="p-3 font-semibold text-slate-500">Type</th>
                          <th className="p-3 font-semibold text-slate-500 text-right">Adjusted Hours</th>
                          <th className="p-3 font-semibold text-slate-500 text-center">Presets</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.filter(emp => emp.type === 'Staff').map((emp) => {
                          const val = localAdjustments[emp.id] ?? 0;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-3">
                                <div className="font-semibold text-slate-800">{emp.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{emp.id}</div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                  emp.type === 'Staff' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {emp.type}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={val || ''}
                                  placeholder="0"
                                  onChange={(e) => handleLocalAdjustmentChange(emp.id, e.target.value === '' ? 0 : Number(e.target.value))}
                                  className="w-20 px-2 py-1 text-right bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono font-semibold text-slate-800"
                                />
                              </td>
                              <td className="p-3">
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() => handleLocalAdjustmentChange(emp.id, 4)}
                                    className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition cursor-pointer"
                                  >
                                    +4h
                                  </button>
                                  <button
                                    onClick={() => handleLocalAdjustmentChange(emp.id, 8)}
                                    className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition cursor-pointer"
                                  >
                                    +8h
                                  </button>
                                  <button
                                    onClick={() => handleLocalAdjustmentChange(emp.id, 12)}
                                    className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition cursor-pointer"
                                  >
                                    +12h
                                  </button>
                                  {val !== 0 && (
                                    <button
                                      onClick={() => handleLocalAdjustmentChange(emp.id, 0)}
                                      className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <div className="bg-indigo-50/50 border border-indigo-100/60 p-3 rounded-2xl text-xs text-indigo-950/90 leading-relaxed">
                      <p className="font-bold text-indigo-800 mb-1">💡 Smart Paste Guideline</p>
                      Copy a two-column list from Google Sheets or Excel and paste it below. First column should have <strong>Employee ID or Name</strong>, second column should have <strong>Hours</strong> (e.g., <code>12</code> or <code>-4</code>).
                    </div>

                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Paste columns from Excel here...&#10;e.g.&#10;EMP001	8&#10;Ananya Patel	12&#10;Sunil Kumar	-4"
                      rows={6}
                      className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400"
                    />

                    {parsedPreview.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Parsing Preview</h4>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                <th className="p-2 font-semibold text-slate-500">Row</th>
                                <th className="p-2 font-semibold text-slate-500">Pasted Content</th>
                                <th className="p-2 font-semibold text-slate-500">Match Status</th>
                                <th className="p-2 font-semibold text-slate-500 text-right">Hours</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {parsedPreview.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition">
                                  <td className="p-2 font-mono text-[10px] text-slate-400">#{item.lineNum}</td>
                                  <td className="p-2 font-medium text-slate-700 truncate max-w-[150px]" title={item.originalLine}>
                                    {item.originalLine}
                                  </td>
                                  <td className="p-2">
                                    {item.status === 'matched' && item.matchedEmployee ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Matched: {item.matchedEmployee.name}
                                      </span>
                                    ) : item.status === 'not-found' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 rounded-md">
                                        <AlertTriangle className="h-3 w-3" />
                                        Employee not found
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 rounded-md">
                                        <X className="h-3 w-3" />
                                        Invalid format
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-slate-800">
                                    {item.hours !== undefined ? (item.hours > 0 ? `+${item.hours}` : item.hours) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => setIsBulkAdjustOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                {bulkTab === 'table' ? (
                  <button
                    onClick={handleSaveTableAdjustments}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs border border-indigo-500 rounded-xl transition cursor-pointer"
                  >
                    Save All Changes
                  </button>
                ) : (
                  <button
                    onClick={handleApplyPaste}
                    disabled={!parsedPreview.some(p => p.status === 'matched')}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs border border-indigo-500 rounded-xl transition cursor-pointer"
                  >
                    Confirm & Apply Matched Rows
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Advances Management Modal */}
        {isAdvancesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-3xl border border-slate-100 flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-emerald-600" />
                    Manage Employee Advances
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Track advance salary or loans deducted during payouts for <strong>{MONTH_NAMES[activeMonth]} {activeYear}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setIsAdvancesOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Import / Export Utility Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Download Card */}
                  <div className="border border-emerald-100 bg-emerald-50/20 p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        1. Download Template
                      </h4>
                      <p className="text-[11px] text-emerald-700/85 mt-2 leading-relaxed">
                        Get a pre-formatted CSV sheet containing names and IDs of all employees. Simply fill in the amount in the <strong>Advance Amount</strong> column.
                      </p>
                    </div>
                    <button
                      onClick={downloadAdvanceTemplate}
                      className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Employee Template
                    </button>
                  </div>

                  {/* Upload Card */}
                  <div className="border border-indigo-100 bg-indigo-50/20 p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-indigo-800 tracking-wider flex items-center gap-1">
                        <Upload className="h-3.5 w-3.5" />
                        2. Upload Filled Sheet
                      </h4>
                      <p className="text-[11px] text-indigo-700/85 mt-2 leading-relaxed">
                        Upload the completed template back. Vardhman Payroll will automatically process the advances and update payouts instantly.
                      </p>
                    </div>
                    <label className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
                      <Upload className="h-3.5 w-3.5" />
                      Upload CSV Template
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleAdvanceUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* 2. Quick Table Editor Area */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                      Or Quick Table Editor
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Changes made here are drafted. Click "Save Advances" to persist.
                    </span>
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                    <div className="max-h-[250px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                            <th className="p-3 font-semibold text-slate-500">Employee</th>
                            <th className="p-3 font-semibold text-slate-500">Type</th>
                            <th className="p-3 font-semibold text-slate-500 text-right">Advance Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {employees.map((emp) => {
                            const val = localAdvances[emp.id] ?? 0;
                            return (
                              <tr key={emp.id} className="hover:bg-slate-50/40 bg-white transition">
                                <td className="p-3">
                                  <div className="font-semibold text-slate-800">{emp.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{emp.id}</div>
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                    emp.type === 'Staff' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {emp.type}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="text-slate-400 font-bold">₹</span>
                                    <input
                                      type="number"
                                      value={val === 0 ? '' : val}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const parsed = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        handleLocalAdvanceChange(emp.id, isNaN(parsed) ? 0 : parsed);
                                      }}
                                      className="w-24 px-2 py-1 text-right text-xs font-bold text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                <button
                  onClick={() => setIsAdvancesOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTableAdvances}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs border border-emerald-500 rounded-xl transition cursor-pointer"
                >
                  Save Advances
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
