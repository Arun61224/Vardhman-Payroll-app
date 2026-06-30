import React, { createContext, useContext, useState, useEffect } from 'react';
import { Employee, AttendanceRecord, MonthlyPayrollSummary, DeletedEmployeeLog } from '../types';
import { calculateMonthlySummary } from '../utils/payroll';

interface PayrollContextType {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  deletedLogs: DeletedEmployeeLog[];
  activeDate: string; // YYYY-MM-DD
  activeMonth: number; // 0-11
  activeYear: number;
  addEmployee: (emp: Omit<Employee, 'id'> & { id?: string }) => void;
  updateEmployee: (emp: Employee) => void;
  bulkUpdateEmployees: (emps: Employee[]) => void;
  deleteEmployee: (id: string) => void;
  restoreEmployee: (id: string) => void;
  clearDeletedLogs: () => void;
  saveAttendance: (records: AttendanceRecord[]) => void;
  setActiveDate: (date: string) => void;
  setActiveMonth: (month: number) => void;
  setActiveYear: (year: number) => void;
  resetToDemoData: () => void;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

// Helpers for localStorage
const LOCAL_STORAGE_KEY_EMPLOYEES = 'payroll_mgmt_employees';
const LOCAL_STORAGE_KEY_ATTENDANCE = 'payroll_mgmt_attendance';

const initialEmployees: Employee[] = [
  { id: 'EMP001', name: 'Rajesh Sharma', type: 'Staff', basicSalary: 45000, standardShiftStart: '08:00', esiDeducted: true, pfDeducted: true, lwfDeducted: true },
  { id: 'EMP002', name: 'Ananya Patel', type: 'Staff', basicSalary: 60000, standardShiftStart: '09:00', esiDeducted: false, pfDeducted: true, lwfDeducted: false },
  { id: 'EMP003', name: 'Sunil Kumar', type: 'Labour', basicSalary: 24000, standardShiftStart: '08:00', esiDeducted: true, pfDeducted: false, lwfDeducted: true },
  { id: 'EMP004', name: 'Amit Singh', type: 'Labour', basicSalary: 27000, standardShiftStart: '08:00', esiDeducted: true, pfDeducted: true, lwfDeducted: true },
  { id: 'EMP005', name: 'Priya Das', type: 'Staff', basicSalary: 52000, standardShiftStart: '08:30', esiDeducted: false, pfDeducted: false, lwfDeducted: false },
  { id: 'EMP006', name: 'Ramesh Yadav', type: 'Labour', basicSalary: 22000, standardShiftStart: '08:00', esiDeducted: true, pfDeducted: true, lwfDeducted: false },
];

// Generate comprehensive mock attendance records for June 2026
const generateMockAttendance = (emps: Employee[]): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const year = 2026;
  const month = 5; // June (0-indexed)
  const daysInMonth = 30;

  // Let's seed attendance up to day 29 (current day is 29 June 2026)
  for (let day = 1; day <= 29; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if Sunday
    const isSunday = new Date(year, month, day).getDay() === 0;

    emps.forEach((emp) => {
      // 1. Sunday Work Policy Simulation
      if (isSunday) {
        // Only some employees work on Sunday (Sundays are usually off)
        // Let's say Amit (Labour) works 2 Sundays, Rajesh (Staff) works 1 Sunday
        if (emp.id === 'EMP004' && (day === 7 || day === 21)) {
          // Worked 8 hours on Sunday (counts as full day for Labour since >= 7 hours)
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '16:00', // 8 hours
          });
        } else if (emp.id === 'EMP003' && day === 14) {
          // Worked 6 hours on Sunday (paid hourly for Labour since < 7 hours)
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '14:00', // 6 hours
          });
        } else if (emp.id === 'EMP001' && day === 14) {
          // Staff Rajesh worked on Sunday for 5 hours (paid hourly)
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '09:00',
            punchOut: '14:00', // 5 hours
          });
        } else {
          // Sunday off
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Absent',
          });
        }
        return;
      }

      // 2. Regular Weekdays (Mon-Sat)
      // We will introduce some variety:
      // - Standard Present: punch in on time, punch out after 9 hours
      // - Late Entry: punch in past grace period
      // - Overtime: work >= 12 hours (earns flat ₹100 bonus)
      // - Leaves: allowed 1.5 paid leaves. We can give some employees 1, 2, or 3 leaves to show deductions.
      // - Absent: unpaid absent days.

      // Specific employee behavior presets:
      // Rajesh (Staff, 08:00 start):
      // - Left early or late? Let's say Rajesh had 1 leave on June 10, and 1 late entry on June 15 (punch in 08:45, grace is 35 mins so late)
      if (emp.id === 'EMP001') {
        if (day === 10) {
          records.push({ employeeId: emp.id, date: dateStr, status: 'Leave' });
        } else if (day === 15) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:45', // 45m late (deducted)
            punchOut: '17:45',
          });
        } else {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '17:00', // 9h
          });
        }
      }

      // Ananya (Staff, 09:00 start, basic 60000):
      // - 1 Overtime day on June 5 (worked 09:00 to 21:00 = 12 hours)
      // - 2 Leaves on June 18 and June 19 (total 2 leaves, exceeds 1.5, should have 0.5 day pay deducted)
      else if (emp.id === 'EMP002') {
        if (day === 18 || day === 19) {
          records.push({ employeeId: emp.id, date: dateStr, status: 'Leave' });
        } else if (day === 5) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:55', // within grace
            punchOut: '21:00', // 12h 05m (Overtime!)
          });
        } else if (day === 24) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '09:40', // late (exceeds 35m grace)
            punchOut: '18:40',
          });
        } else {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '09:00',
            punchOut: '18:00',
          });
        }
      }

      // Sunil (Labour, 08:00 start, basic 24000):
      // - 1 Absent day on June 12 (unpaid)
      // - 1 Late entry on June 22 (08:35, grace is 30 mins, late by 35 mins)
      else if (emp.id === 'EMP003') {
        if (day === 12) {
          records.push({ employeeId: emp.id, date: dateStr, status: 'Absent' });
        } else if (day === 22) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:35', // late (exceeds 30m grace)
            punchOut: '17:35',
          });
        } else {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '17:00',
          });
        }
      }

      // Amit (Labour, 08:00 start, basic 27000):
      // - Works overtime frequently. Let's give him OT on June 3, June 17, and June 25 (worked 08:00 to 20:00 = 12h)
      // - No leaves, no lates
      else if (emp.id === 'EMP004') {
        if (day === 3 || day === 17 || day === 25) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '20:00', // 12 hours (OT!)
          });
        } else {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '17:00',
          });
        }
      }

      // Priya (Staff, 08:30 start, basic 52000):
      // - 3 Leaves on June 2, June 3, June 4 (total 3 leaves, exceeds 1.5, should have 1.5 days pay deducted)
      else if (emp.id === 'EMP005') {
        if (day >= 2 && day <= 4) {
          records.push({ employeeId: emp.id, date: dateStr, status: 'Leave' });
        } else {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:30',
            punchOut: '17:30',
          });
        }
      }

      // Ramesh (Labour, 08:00 start, basic 22000):
      // - A few late entries within grace (08:25), one late entry outside grace (08:50) on June 11
      else if (emp.id === 'EMP006') {
        if (day === 11) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:50', // late (exceeds 30m grace)
            punchOut: '17:50',
          });
        } else if (day === 16) {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:25', // within 30m grace
            punchOut: '17:25',
          });
        } else {
          records.push({
            employeeId: emp.id,
            date: dateStr,
            status: 'Present',
            punchIn: '08:00',
            punchOut: '17:00',
          });
        }
      }
    });
  }

  return records;
};

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_EMPLOYEES);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing employees from localStorage', e);
      }
    }
    return initialEmployees;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing attendance from localStorage', e);
      }
    }
    return generateMockAttendance(initialEmployees);
  });

  const [deletedLogs, setDeletedLogs] = useState<DeletedEmployeeLog[]>(() => {
    const saved = localStorage.getItem('payroll_mgmt_deleted_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing deleted logs from localStorage', e);
      }
    }
    return [];
  });

  // Default to today
  const [activeDate, setActiveDate] = useState<string>(() => {
    const today = new Date();
    // Default to a date in June 2026 for simulation if it matches, otherwise real calendar date
    const dStr = today.toISOString().split('T')[0];
    if (dStr.startsWith('2026-06')) {
      return dStr;
    }
    return '2026-06-29'; // Default simulation date
  });

  const [activeMonth, setActiveMonth] = useState<number>(5); // June
  const [activeYear, setActiveYear] = useState<number>(2026);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('payroll_mgmt_deleted_logs', JSON.stringify(deletedLogs));
  }, [deletedLogs]);

  const addEmployee = (emp: Omit<Employee, 'id'> & { id?: string }) => {
    setEmployees((prev) => {
      let finalId = emp.id?.trim();
      if (!finalId) {
        // Find the highest ID and increment
        const ids = prev.map((e) => parseInt(e.id.replace('EMP', ''), 10)).filter((n) => !isNaN(n));
        const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1;
        finalId = `EMP${String(nextNum).padStart(3, '0')}`;
      }
      
      const exists = prev.some((e) => e.id === finalId);
      if (exists) {
        return prev.map((e) => (e.id === finalId ? { ...e, ...emp, id: finalId } : e));
      } else {
        return [...prev, { ...emp, id: finalId }];
      }
    });
  };

  const updateEmployee = (emp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
  };

  const bulkUpdateEmployees = (emps: Employee[]) => {
    setEmployees(emps);
  };

  const deleteEmployee = (id: string) => {
    const empToDelete = employees.find((e) => e.id === id);
    if (empToDelete) {
      const logEntry: DeletedEmployeeLog = {
        id: empToDelete.id,
        name: empToDelete.name,
        type: empToDelete.type,
        deletedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        basicSalary: empToDelete.basicSalary,
      };
      setDeletedLogs((prev) => [logEntry, ...prev]);
    }
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setAttendanceRecords((prev) => prev.filter((r) => r.employeeId !== id));
  };

  const restoreEmployee = (id: string) => {
    const logToRestore = deletedLogs.find((l) => l.id === id);
    if (logToRestore) {
      const restoredEmp: Employee = {
        id: logToRestore.id,
        name: logToRestore.name,
        type: logToRestore.type,
        basicSalary: logToRestore.basicSalary,
        standardShiftStart: logToRestore.type === 'Staff' ? '08:30' : '08:00', // default standard start
        esiDeducted: true,
        pfDeducted: true,
        lwfDeducted: true,
      };
      setEmployees((prev) => [...prev, restoredEmp]);
      setDeletedLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const clearDeletedLogs = () => {
    setDeletedLogs([]);
  };

  const saveAttendance = (records: AttendanceRecord[]) => {
    setAttendanceRecords((prev) => {
      // Create a map of existing records to easily replace or merge
      const filtered = prev.filter((r) => {
        // Remove existing records for the same employee and date
        const match = records.some((newR) => newR.employeeId === r.employeeId && newR.date === r.date);
        return !match;
      });
      return [...filtered, ...records];
    });
  };

  const resetToDemoData = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY_EMPLOYEES);
    localStorage.removeItem(LOCAL_STORAGE_KEY_ATTENDANCE);
    localStorage.removeItem('payroll_mgmt_deleted_logs');
    setEmployees(initialEmployees);
    setAttendanceRecords(generateMockAttendance(initialEmployees));
    setDeletedLogs([]);
    setActiveDate('2026-06-29');
    setActiveMonth(5);
    setActiveYear(2026);
  };

  return (
    <PayrollContext.Provider
      value={{
        employees,
        attendanceRecords,
        deletedLogs,
        activeDate,
        activeMonth,
        activeYear,
        addEmployee,
        updateEmployee,
        bulkUpdateEmployees,
        deleteEmployee,
        restoreEmployee,
        clearDeletedLogs,
        saveAttendance,
        setActiveDate,
        setActiveMonth,
        setActiveYear,
        resetToDemoData,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayroll = () => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll must be used within a PayrollProvider');
  }
  return context;
};
