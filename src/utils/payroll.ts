import { Employee, AttendanceRecord, DayPayrollDetails, MonthlyPayrollSummary, AttendanceStatus } from '../types';

// Convert "HH:MM" string to minutes from 00:00
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

// Convert minutes from 00:00 to "HH:MM" string
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Check if a given "YYYY-MM-DD" date string is a Sunday
export function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  // Use UTC or local date safely. 
  // Replacing hyphens with slashes ensures parsing in local timezone rather than UTC
  const date = new Date(dateStr.replace(/-/g, '/'));
  return date.getDay() === 0;
}

// Format date to readable string (e.g., "29 Jun (Mon)")
export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(/-/g, '/'));
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

// Calculate hours worked between punch in and punch out
export function calculateHoursWorked(punchIn: string, punchOut: string): number {
  const inMins = timeToMinutes(punchIn);
  const outMins = timeToMinutes(punchOut);
  if (outMins <= inMins) {
    // Handling cross-midnight shift if any, but default positive
    return 0;
  }
  return (outMins - inMins) / 60;
}

// Calculate payroll details for a single day
export function calculateDailyPayroll(
  employee: Employee,
  record: AttendanceRecord
): DayPayrollDetails {
  const { basicSalary, type, standardShiftStart } = employee;
  const { date, status, punchIn, punchOut } = record;
  const sunday = isSunday(date);

  const oneDayPay = basicSalary / 30;
  const hourlyWage = oneDayPay / 9;

  let hoursWorked = 0;
  let dailyWage = 0;
  let lateMinutes = 0;
  let lateDeduction = 0;
  let overtimeBonus = 0;
  let netPay = 0;
  let explanation = '';

  if (status === 'Absent') {
    // Weekdays: Absent means a day's deduction (handled in monthly summary).
    // Sundays: No attendance needed unless they work. Absent on Sunday is fine, no deduction.
    explanation = sunday ? 'Sunday (Weekly Off)' : 'Absent (No Pay)';
    return {
      date,
      isSunday: sunday,
      status,
      hoursWorked: 0,
      dailyWage: 0,
      lateMinutes: 0,
      lateDeduction: 0,
      overtimeBonus: 0,
      netPay: 0,
      explanation,
    };
  }

  if (status === 'Leave') {
    explanation = 'Leave Applied';
    return {
      date,
      isSunday: sunday,
      status,
      hoursWorked: 0,
      dailyWage: 0,
      lateMinutes: 0,
      lateDeduction: 0,
      overtimeBonus: 0,
      netPay: 0,
      explanation,
    };
  }

  // Employee is Present
  if (punchIn && punchIn !== '-' && punchOut && punchOut !== '-') {
    hoursWorked = calculateHoursWorked(punchIn, punchOut);
    
    // 1. Overtime Calculation:
    // If total working hours >= 12 (i.e. standard 9 hours + 3 hours OT), add ₹100 flat bonus
    if (hoursWorked >= 12) {
      overtimeBonus = 100;
    }

    // 2. Late Entry Calculation:
    // Grace period: Staff = 35 mins, Labour = 30 mins
    const gracePeriod = type === 'Staff' ? 35 : 30;
    const startMins = timeToMinutes(standardShiftStart);
    const actualInMins = timeToMinutes(punchIn);

    if (actualInMins > startMins) {
      lateMinutes = actualInMins - startMins;
      if (lateMinutes > gracePeriod) {
        // Exceeded grace period, deduct standard hourly rate for the complete time missed
        lateDeduction = (lateMinutes / 60) * hourlyWage;
      }
    }

    // 3. Sunday Pay Calculation:
    if (sunday) {
      if (type === 'Labour') {
        // Labour: If they work for 7 hours, they receive full 9-hour payment (1 Day Pay)
        if (hoursWorked >= 7) {
          dailyWage = oneDayPay;
          explanation = `Sunday Overtime: Worked ${hoursWorked.toFixed(2)}h (>= 7h), paid Full Day Wage.`;
        } else {
          // Less than 7 hours: let's pay proportionally
          dailyWage = hoursWorked * hourlyWage;
          explanation = `Sunday Overtime: Worked ${hoursWorked.toFixed(2)}h (< 7h), paid hourly.`;
        }
      } else {
        // Staff: Paid strictly on hourly basis for Sundays
        dailyWage = hoursWorked * hourlyWage;
        explanation = `Sunday Overtime: Worked ${hoursWorked.toFixed(2)}h, paid strictly Hourly.`;
      }
      
      // Net pay for Sunday = Extra daily wage + Overtime Bonus - Late Deduction
      netPay = dailyWage + overtimeBonus - lateDeduction;
    } else {
      // Weekday / Regular Working Day
      // Basic salary already covers standard weekdays.
      // So the weekday daily earnings component is covered, but we track late deductions and overtime bonuses.
      dailyWage = oneDayPay;
      netPay = dailyWage + overtimeBonus - lateDeduction;
      
      explanation = `Present. Worked ${hoursWorked.toFixed(2)}h.`;
      if (lateMinutes > 0) {
        if (lateMinutes > gracePeriod) {
          explanation += ` Late by ${lateMinutes}m (Grace ${gracePeriod}m exceeded: -₹${lateDeduction.toFixed(2)}).`;
        } else {
          explanation += ` Late by ${lateMinutes}m (Within Grace ${gracePeriod}m: No deduction).`;
        }
      }
      if (overtimeBonus > 0) {
        explanation += ` Overtime Bonus (+₹100).`;
      }
    }
  } else {
    explanation = 'Missing Punch In/Out (Unpaid)';
  }

  return {
    date,
    isSunday: sunday,
    status,
    punchIn,
    punchOut,
    hoursWorked,
    dailyWage,
    lateMinutes,
    lateDeduction,
    overtimeBonus,
    netPay,
    explanation,
  };
}

// Generate monthly payroll summary for an employee
export function calculateMonthlySummary(
  employee: Employee,
  records: AttendanceRecord[],
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
): MonthlyPayrollSummary {
  const { basicSalary, type } = employee;
  const oneDayPay = basicSalary / 30;
  const hourlyWage = oneDayPay / 9;

  // Find all dates in the selected month
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyDetails: DayPayrollDetails[] = [];

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLeave = 0;

  let totalHoursWorked = 0;
  let totalLateMinutes = 0;
  let totalLateDeductions = 0;
  let totalOvertimeBonuses = 0;
  let totalSundayPay = 0;

  for (let day = 1; day <= totalDaysInMonth; day++) {
    // Format date as YYYY-MM-DD
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const sunday = isSunday(dateStr);

    // Find if there is a record for this day
    const record = records.find((r) => r.employeeId === employee.id && r.date === dateStr);

    if (record) {
      const details = calculateDailyPayroll(employee, record);
      dailyDetails.push(details);

      if (record.status === 'Present') {
        const hasPunches = record.punchIn && record.punchIn !== '-' && record.punchOut && record.punchOut !== '-';
        if (hasPunches) {
          daysPresent++;
          totalHoursWorked += details.hoursWorked;
          totalLateMinutes += details.lateMinutes;
          totalLateDeductions += details.lateDeduction;
          totalOvertimeBonuses += details.overtimeBonus;
          if (sunday) {
            totalSundayPay += details.dailyWage; // Sunday wage is extra
          }
        } else {
          // Present status but missing punchIn or punchOut -> Treat as unpaid/absent!
          if (!sunday) {
            daysAbsent++;
          }
        }
      } else if (record.status === 'Absent') {
        if (!sunday) {
          daysAbsent++; // Only count weekdays as unpaid absent
        }
      } else if (record.status === 'Leave') {
        daysLeave++;
      }
    } else {
      // No record exists
      if (sunday) {
        // Sunday defaults to off
        dailyDetails.push({
          date: dateStr,
          isSunday: true,
          status: 'Absent',
          hoursWorked: 0,
          dailyWage: 0,
          lateMinutes: 0,
          lateDeduction: 0,
          overtimeBonus: 0,
          netPay: 0,
          explanation: 'Sunday (Weekly Off)',
        });
      } else {
        // Weekday with no record is treated as Absent (no pay)
        daysAbsent++;
        dailyDetails.push({
          date: dateStr,
          isSunday: false,
          status: 'Absent',
          hoursWorked: 0,
          dailyWage: 0,
          lateMinutes: 0,
          lateDeduction: 0,
          overtimeBonus: 0,
          netPay: 0,
          explanation: 'No Attendance Recorded (Unpaid)',
        });
      }
    }
  }

  // Monthly Leave Calculation:
  // Allowed: Staff = 1.5 days of paid leave. Labour = 0 days.
  // Any leave beyond the allowance is deducted at the rate of 1 Day Pay.
  const allowedLeaves = employee.type === 'Staff' ? 1.5 : 0;
  const unpaidLeaves = Math.max(0, daysLeave - allowedLeaves);
  const leaveDeductions = unpaidLeaves * oneDayPay;

  // Unpaid Absent Days deduction:
  // Every absent weekday causes a deduction of 1 Day Pay
  const absentDeductions = daysAbsent * oneDayPay;

  // Final Payable Salary Formula:
  // Final = Basic Salary - Leave Deductions (leaves > 1.5) - Absent Deductions - Late Deductions + Overtime Bonuses + Sunday Overtime Pay
  const finalPayableSalary = Math.max(
    0,
    basicSalary - leaveDeductions - absentDeductions - totalLateDeductions + totalOvertimeBonuses + totalSundayPay
  );

  const esiDeduction = employee.esiDeducted ? Number((finalPayableSalary * 0.0075).toFixed(2)) : 0;
  const pfDeduction = employee.pfDeducted ? Number((finalPayableSalary * 0.12).toFixed(2)) : 0;
  const lwfDeduction = employee.lwfDeducted ? Math.min(35, Number((finalPayableSalary * 0.002).toFixed(2))) : 0;
  const netTakeHome = Math.max(0, Number((finalPayableSalary - esiDeduction - pfDeduction - lwfDeduction).toFixed(2)));

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeType: type,
    basicSalary,
    oneDayPay,
    hourlyWage,
    
    daysPresent,
    daysAbsent,
    daysLeave,
    
    totalHoursWorked,
    totalLateMinutes,
    totalLateDeductions,
    totalOvertimeBonuses,
    
    leaveDeductions: leaveDeductions + absentDeductions, // Let's combine both leaves > 1.5 and absent deductions for display
    finalPayableSalary,
    
    esiDeduction,
    pfDeduction,
    lwfDeduction,
    netTakeHome,
    
    dailyDetails,
  };
}

// Normalize and format time string safely to "HH:MM" (e.g., "9:30" -> "09:30", "08:15 AM" -> "08:15", "07:26 PM" -> "19:26")
export function normalizeTime(timeStr: string | undefined | null, defaultFallback = '08:00'): string {
  if (!timeStr) return defaultFallback;
  
  const trimmed = timeStr.trim();
  if (trimmed === '') return defaultFallback;

  // Check if it has AM/PM
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*)?(AM|PM|am|pm)?$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3];
    
    if (ampm) {
      const isPm = ampm.toUpperCase() === 'PM';
      if (isPm && hours < 12) {
        hours += 12;
      } else if (!isPm && hours === 12) {
        hours = 0;
      }
    }
    
    if (!isNaN(hours) && !isNaN(minutes)) {
      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      return `${hStr}:${mStr}`;
    }
  }

  // Fallback to simpler split in case of weird characters
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      return `${hStr}:${mStr}`;
    }
  }
  
  return defaultFallback;
}
