import React, { useState, useEffect } from 'react';
import { usePayroll } from '../context/PayrollContext';
import { AttendanceRecord, AttendanceStatus, Employee } from '../types';
import { Calendar, Save, Check, Clock, AlertTriangle, Moon, HelpCircle, CheckCircle2, UserCheck, RefreshCw, Upload, X, FileSpreadsheet, Download } from 'lucide-react';
import { isSunday, calculateHoursWorked, timeToMinutes, formatReadableDate } from '../utils/payroll';
import { motion, AnimatePresence } from 'motion/react';

export const AttendanceTracker: React.FC = () => {
  const { employees, attendanceRecords, activeDate, saveAttendance, setActiveDate } = usePayroll();
  
  // Local mutable state for editing the selected date's attendance
  const [localRecords, setLocalRecords] = useState<{ [empId: string]: Omit<AttendanceRecord, 'employeeId' | 'date'> }>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const sunday = isSunday(activeDate);

  // CSV Import States for Attendance
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'single' | 'multi'>('multi');
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  const handleAttendanceCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processAttendanceCsv(text);
    };
    reader.readAsText(file);
  };

  const processAttendanceCsv = (text: string) => {
    try {
      setImportError(null);
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      if (lines.length <= 1) {
        setImportError('The CSV file is empty or missing data rows.');
        return;
      }

      const headersLine = lines[0].toLowerCase();
      const partsFirst = lines[0].split(',').map(p => p.trim().toLowerCase());
      const hasDateColumn = partsFirst.includes('date');

      // Auto-switch uploadMode depending on whether Date is present
      if (hasDateColumn) {
        setUploadMode('multi');
      } else {
        setUploadMode('single');
      }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue; // Skip empty/invalid lines

        let dateVal = activeDate;
        let empId = '';
        let statusStr = '';
        let punchIn = '08:00';
        let punchOut = '17:00';

        if (hasDateColumn) {
          // Format: Date, EmployeeID, Status, PunchIn, PunchOut
          if (parts.length < 3) {
            throw new Error(`Row ${i + 1} has insufficient columns for Multi-Day format. Need at least Date, EmployeeID, Status.`);
          }
          dateVal = parts[0];
          empId = parts[1];
          statusStr = parts[2] || 'Present';
          punchIn = parts[3] || '08:00';
          punchOut = parts[4] || '17:00';

          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(dateVal)) {
            throw new Error(`Row ${i + 1} has invalid Date format: "${dateVal}". Must be in YYYY-MM-DD format.`);
          }
        } else {
          // Format: EmployeeID, Status, PunchIn, PunchOut
          empId = parts[0];
          statusStr = parts[1] || 'Present';
          punchIn = parts[2] || '08:00';
          punchOut = parts[3] || '17:00';
        }
        
        let status: AttendanceStatus = 'Present';
        const lowerStatus = statusStr.toLowerCase();
        if (lowerStatus.includes('absent')) status = 'Absent';
        else if (lowerStatus.includes('leave')) status = 'Leave';

        const empExists = employees.some(emp => emp.id.toLowerCase() === empId.toLowerCase());
        const matchedEmp = employees.find(emp => emp.id.toLowerCase() === empId.toLowerCase());

        rows.push({
          rowNum: i + 1,
          date: dateVal,
          employeeId: matchedEmp ? matchedEmp.id : empId,
          employeeName: matchedEmp ? matchedEmp.name : 'Unknown ID',
          exists: empExists,
          status,
          punchIn: status === 'Present' ? punchIn : undefined,
          punchOut: status === 'Present' ? punchOut : undefined,
        });
      }

      setImportPreview(rows);
    } catch (err: any) {
      setImportError(err.message || 'Error parsing CSV file. Please match the template structure.');
      setImportPreview([]);
    }
  };

  const applyImportedAttendance = () => {
    if (importPreview.length === 0) return;

    // Direct save to global state for multi-day
    if (uploadMode === 'multi') {
      const formatted: AttendanceRecord[] = importPreview
        .filter(row => row.exists)
        .map(row => ({
          employeeId: row.employeeId,
          date: row.date,
          status: row.status,
          punchIn: row.punchIn,
          punchOut: row.punchOut,
        }));
      
      saveAttendance(formatted);
      
      // Also update localRecords for active date if it was present
      const activeDateImports = importPreview.filter(row => row.date === activeDate && row.exists);
      if (activeDateImports.length > 0) {
        setLocalRecords(prev => {
          const updated = { ...prev };
          activeDateImports.forEach(row => {
            updated[row.employeeId] = {
              status: row.status,
              punchIn: row.punchIn || employees.find(e => e.id === row.employeeId)?.standardShiftStart || '08:00',
              punchOut: row.punchOut || '17:00',
            };
          });
          return updated;
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      // Single day, apply locally to localRecords
      setLocalRecords(prev => {
        const updated = { ...prev };
        importPreview.forEach(row => {
          if (row.exists) {
            updated[row.employeeId] = {
              status: row.status,
              punchIn: row.status === 'Present' ? (row.punchIn || '08:00') : undefined,
              punchOut: row.status === 'Present' ? (row.punchOut || '17:00') : undefined,
            };
          }
        });
        return updated;
      });
    }

    setIsImportModalOpen(false);
    setImportPreview([]);
  };

  const downloadAttendanceTemplate = (type: 'single' | 'multi' = 'multi') => {
    if (type === 'multi') {
      const headers = 'Date,EmployeeID,Status,PunchIn,PunchOut\n';
      let rows = '';
      
      const current = new Date(activeDate.replace(/-/g, '/'));
      const d1 = current.toISOString().split('T')[0];
      
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      const d2 = next.toISOString().split('T')[0];

      if (employees.length > 0) {
        employees.forEach((emp, idx) => {
          const dateStr = idx % 2 === 0 ? d1 : d2;
          const isAbsent = idx === 1;
          rows += `${dateStr},${emp.id},${isAbsent ? 'Absent' : 'Present'},${isAbsent ? '' : emp.standardShiftStart},${isAbsent ? '' : '17:00'}\n`;
        });
      } else {
        rows += `${d1},EMP001,Present,08:00,17:00\n`;
        rows += `${d1},EMP002,Absent,,\n`;
        rows += `${d2},EMP001,Present,08:00,17:00\n`;
        rows += `${d2},EMP002,Present,08:00,17:00\n`;
      }
      
      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `attendance_multiday_template.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = 'EmployeeID,Status,PunchIn,PunchOut\n';
      let rows = '';
      if (employees.length > 0) {
        employees.forEach((emp, index) => {
          const isAbsent = index === 1;
          rows += `${emp.id},${isAbsent ? 'Absent' : 'Present'},${isAbsent ? '' : emp.standardShiftStart},${isAbsent ? '' : '17:00'}\n`;
        });
      } else {
        rows += 'EMP001,Present,08:30,17:30\n';
        rows += 'EMP002,Absent,,\n';
        rows += 'EMP003,Present,08:00,17:00\n';
      }
      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `attendance_daily_template_${activeDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Initialize local status state when activeDate or employees change
  useEffect(() => {
    const recordsForDate: { [empId: string]: Omit<AttendanceRecord, 'employeeId' | 'date'> } = {};

    employees.forEach((emp) => {
      // Find existing record
      const match = attendanceRecords.find((r) => r.employeeId === emp.id && r.date === activeDate);
      
      if (match) {
        recordsForDate[emp.id] = {
          status: match.status,
          punchIn: match.punchIn || emp.standardShiftStart,
          punchOut: match.punchOut || '17:00', // Default 9 hours later if shift is 8am
        };
      } else {
        // Default record
        recordsForDate[emp.id] = {
          status: sunday ? 'Absent' : 'Present', // Sunday off by default, weekdays present
          punchIn: emp.standardShiftStart,
          punchOut: '17:00', // Default 9 hours later
        };
      }
    });

    setLocalRecords(recordsForDate);
  }, [activeDate, employees, attendanceRecords, sunday]);

  const handleStatusChange = (empId: string, status: AttendanceStatus) => {
    setLocalRecords((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        status,
      },
    }));
  };

  const handlePunchChange = (empId: string, field: 'punchIn' | 'punchOut', value: string) => {
    setLocalRecords((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));
  };

  const handleBulkPreset = (presetStatus: AttendanceStatus) => {
    setLocalRecords((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[id] = {
          ...updated[id],
          status: presetStatus,
        };
      });
      return updated;
    });
  };

  const handleSave = () => {
    const formatted: AttendanceRecord[] = Object.keys(localRecords).map((empId) => {
      const rec = localRecords[empId];
      return {
        employeeId: empId,
        date: activeDate,
        status: rec.status,
        punchIn: rec.status === 'Present' ? rec.punchIn : undefined,
        punchOut: rec.status === 'Present' ? rec.punchOut : undefined,
      };
    });

    saveAttendance(formatted);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Quick date change increments
  const adjustDate = (days: number) => {
    const current = new Date(activeDate.replace(/-/g, '/'));
    current.setDate(current.getDate() + days);
    setActiveDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {/* Save Toast Notification */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-slate-800"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">Daily attendance logs saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date Picker Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            Shift Logs & Timecards
          </h2>
          <p className="text-xs text-slate-500">Record check-ins, leaves, and overtimes for your complete workforce.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Date Stepper */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => adjustDate(-1)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white rounded-lg transition"
            >
              Prev Day
            </button>
            <input
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
              className="px-2 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => adjustDate(1)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white rounded-lg transition"
            >
              Next Day
            </button>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition rounded-xl flex items-center gap-1.5 border border-indigo-100"
            title="Import checking times from file"
          >
            <Upload className="h-4 w-4" />
            Upload Logs
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Save className="h-4 w-4" />
            Save Attendance
          </button>
        </div>
      </div>

      {/* Special Day Overviews */}
      {sunday && (
        <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-800">Sunday Overtime Protocol Active</h4>
            <p className="text-xs text-amber-700">
              Sundays are weekly offs. Any personnel marked <strong>Present</strong> will earn additional overtime:
            </p>
            <ul className="list-disc list-inside text-xs text-amber-700/95 space-y-0.5 pl-1">
              <li><strong>Labour:</strong> Worked 7+ hours counts as full day (paid full 9-hour wage). Otherwise paid strictly hourly.</li>
              <li><strong>Staff:</strong> Paid strictly on an hourly basis for all hours worked on Sunday.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Bulk Presets Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold text-slate-500">Quick Presets:</span>
        <button
          onClick={() => handleBulkPreset('Present')}
          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-100 transition"
        >
          Mark All Present
        </button>
        <button
          onClick={() => handleBulkPreset('Absent')}
          className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-100 transition"
        >
          Mark All Absent
        </button>
        <button
          onClick={() => handleBulkPreset('Leave')}
          className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
        >
          Mark All Leave
        </button>
      </div>

      {/* Core Attendance Logging Rows */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-semibold">No registered employees to track</p>
            <p className="text-xs mt-1">Please add employees first in the Directory dashboard.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {employees.map((emp) => {
              const localState = localRecords[emp.id] || { status: 'Present', punchIn: emp.standardShiftStart, punchOut: '17:00' };
              const isPresent = localState.status === 'Present';
              
              // Project metrics in real-time
              const hoursWorked = isPresent && localState.punchIn && localState.punchOut
                ? calculateHoursWorked(localState.punchIn, localState.punchOut)
                : 0;

              const isOvertime = hoursWorked >= 12;

              // Grace & late projection
              const gracePeriod = emp.type === 'Staff' ? 35 : 30;
              const shiftStartMins = timeToMinutes(emp.standardShiftStart);
              const punchInMins = isPresent && localState.punchIn ? timeToMinutes(localState.punchIn) : 0;
              const isLate = isPresent && punchInMins > shiftStartMins;
              const lateMinutes = isLate ? punchInMins - shiftStartMins : 0;
              const lateExceeded = lateMinutes > gracePeriod;

              const hourlyWage = (emp.basicSalary / 30) / 9;
              const projectedPenalty = lateExceeded ? (lateMinutes / 60) * hourlyWage : 0;

              return (
                <div key={emp.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-5 hover:bg-slate-50/20 transition-colors">
                  {/* Left: Employee Info */}
                  <div className="lg:w-1/4 space-y-1">
                    <span className="text-xs font-mono font-semibold text-slate-400">{emp.id}</span>
                    <h3 className="font-bold text-slate-800">{emp.name}</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          emp.type === 'Staff' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {emp.type}
                      </span>
                      <span className="text-[10px] text-slate-400">Shift starts {emp.standardShiftStart}</span>
                    </div>
                  </div>

                  {/* Middle: Attendance Status Selection */}
                  <div className="lg:w-1/4 flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    {(['Present', 'Absent', 'Leave'] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(emp.id, st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          localState.status === st
                            ? st === 'Present'
                              ? 'bg-emerald-600 text-white'
                              : st === 'Absent'
                              ? 'bg-rose-600 text-white'
                              : 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Right: Time entry inputs (Visible only if marked Present) */}
                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                    {isPresent ? (
                      <>
                        {/* Time pickers */}
                        <div className="flex items-center gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Punch In</label>
                            <input
                              type="time"
                              value={localState.punchIn}
                              onChange={(e) => handlePunchChange(emp.id, 'punchIn', e.target.value)}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-mono text-xs font-semibold text-slate-700"
                            />
                          </div>

                          <span className="text-slate-300 self-end mb-2">—</span>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Punch Out</label>
                            <input
                              type="time"
                              value={localState.punchOut}
                              onChange={(e) => handlePunchChange(emp.id, 'punchOut', e.target.value)}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-mono text-xs font-semibold text-slate-700"
                            />
                          </div>
                        </div>

                        {/* Calculations feedback */}
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              Duration: <strong className="text-slate-800">{hoursWorked.toFixed(2)} hours</strong>
                            </div>
                            
                            {/* Grace & late alerts */}
                            {isLate ? (
                              lateExceeded ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100/30">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Late by {lateMinutes}m (Deduction: -₹{projectedPenalty.toFixed(1)})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/30">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  Late by {lateMinutes}m (Excused under {gracePeriod}m grace)
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/30">
                                <Check className="h-3 w-3 shrink-0" />
                                Punch on-time
                              </span>
                            )}
                          </div>

                          {/* Overtime tag */}
                          {isOvertime && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                              ⭐ Overtime Bonus (+₹100)
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 py-2 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-center">
                        <span className="text-xs text-slate-400 font-medium italic">
                          {localState.status === 'Absent' ? 'No hours computed (Absent)' : 'Excused monthly allowance (Leave)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Button Floating helper */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleSave}
          className="w-full md:w-auto px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          <Save className="h-4 w-4" />
          Save and Calculate Wages
        </button>
      </div>

      {/* Attendance Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsImportModalOpen(false);
                setImportPreview([]);
                setImportError(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-10"
            >
              <div className="bg-slate-50 px-6 py-4 border-b-4 border-black flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-base sm:text-lg uppercase tracking-tight">
                    <Upload className="h-5 w-5 text-indigo-600" />
                    Bulk Attendance Upload
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                    Import attendance logs using CSV file
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportPreview([]);
                    setImportError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/55 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Upload Mode Tabs (Only visible when no file is uploaded yet, to guide the user) */}
                {importPreview.length === 0 && (
                  <div className="flex border-2 border-black rounded-xl p-1 bg-slate-100">
                    <button
                      type="button"
                      onClick={() => setUploadMode('multi')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        uploadMode === 'multi'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📅 Multi-Day (Date Range) Bulk Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('single')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        uploadMode === 'single'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📆 Daily (Single Day) Upload
                    </button>
                  </div>
                )}

                {/* Format Instructions */}
                <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-indigo-200 text-xs text-indigo-950 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-black text-indigo-900 text-sm uppercase tracking-wide">
                        {uploadMode === 'multi' ? '📅 Multi-Day CSV Structure' : '📆 Single-Day CSV Structure'}
                      </span>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        {uploadMode === 'multi' 
                          ? 'Upload multiple dates together in one file'
                          : `Applies strictly to selected date: ${formatReadableDate(activeDate)}`
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadAttendanceTemplate(uploadMode)}
                      className="px-3 py-1.5 border-2 border-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Template
                    </button>
                  </div>

                  <p className="text-slate-600 leading-relaxed font-semibold">
                    Ensure your CSV has a header row and matches this structure exactly:
                  </p>
                  
                  {uploadMode === 'multi' ? (
                    <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto select-all border-2 border-black">
                      Date, EmployeeID, Status, PunchIn, PunchOut
                      <br />
                      2026-06-29, EMP001, Present, 08:15, 17:30
                      <br />
                      2026-06-29, EMP002, Absent, , 
                      <br />
                      2026-06-30, EMP001, Present, 08:00, 17:00
                    </div>
                  ) : (
                    <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto select-all border-2 border-black">
                      EmployeeID, Status, PunchIn, PunchOut
                      <br />
                      EMP001, Present, 08:15, 17:30
                      <br />
                      EMP002, Absent, , 
                      <br />
                      EMP003, Present, 08:35, 18:05
                    </div>
                  )}

                  <div className="text-[10px] text-indigo-700/80 leading-tight font-bold">
                    * <strong>Status</strong>: <code>Present</code>, <code>Absent</code>, or <code>Leave</code>.
                    {uploadMode === 'multi' && <span> <strong>Date</strong> must be in <code>YYYY-MM-DD</code> format (e.g. <code>2026-06-29</code>).</span>}
                    <span> 24-hour time format (HH:MM) is required for punch times.</span>
                  </div>
                </div>

                {/* File Uploader */}
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 transition rounded-2xl p-6 text-center relative bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleAttendanceCsvUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <FileSpreadsheet className="h-10 w-10 text-indigo-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Select or drag & drop CSV file</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Accepts standard .csv files</span>
                    </div>
                  </div>
                </div>

                {/* Parsing Errors */}
                {importError && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-500 text-rose-800 text-xs rounded-xl font-bold">
                    ⚠️ Error parsing file: {importError}
                  </div>
                )}

                {/* Preview Panel */}
                {importPreview.length > 0 && (
                  <div className="space-y-2 pt-2 border-t-2 border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        📋 {importPreview.length} Records Parsed ({uploadMode === 'multi' ? 'Multi-Day Mode' : 'Single-Day Mode'})
                      </span>
                      <button
                        onClick={() => { setImportPreview([]); }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold uppercase tracking-wide hover:underline cursor-pointer"
                      >
                        Clear File
                      </button>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {uploadMode === 'multi' && <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">Date</th>}
                            <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">ID</th>
                            <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">Employee Name</th>
                            <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">Status</th>
                            <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">Punch In</th>
                            <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">Punch Out</th>
                            <th className="p-2.5 font-extrabold text-slate-600 uppercase tracking-wider">Verify</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50/50">
                              {uploadMode === 'multi' && <td className="p-2.5 font-mono text-slate-700 font-bold">{row.date}</td>}
                              <td className="p-2.5 font-mono text-indigo-700 font-bold">{row.employeeId}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{row.employeeName}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  row.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  row.status === 'Absent' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-slate-600 font-semibold">{row.status === 'Present' ? row.punchIn : '—'}</td>
                              <td className="p-2.5 font-mono text-slate-600 font-semibold">{row.status === 'Present' ? row.punchOut : '—'}</td>
                              <td className="p-2.5">
                                {row.exists ? (
                                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase">✓ Valid</span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-extrabold uppercase">⚠️ Not Found</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t-2 border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportPreview([]);
                    setImportError(null);
                  }}
                  className="px-4 py-2 border-2 border-black bg-white hover:bg-slate-100 text-black rounded-xl font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importPreview.length === 0}
                  onClick={applyImportedAttendance}
                  className={`px-4 py-2 border-2 border-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer ${
                    importPreview.length === 0 ? 'opacity-50 cursor-not-allowed shadow-none' : ''
                  }`}
                >
                  {uploadMode === 'multi' ? 'Save Bulk Logs Directly' : 'Apply to Daily Logs'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
