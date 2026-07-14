export type EmployeeType = 'Staff' | 'Labour';

export interface Employee {
  id: string; // e.g. "EMP001"
  name: string;
  type: EmployeeType;
  basicSalary: number; // monthly
  standardShiftStart: string; // "HH:MM" e.g. "08:00"
  esiDeducted?: boolean;
  pfDeducted?: boolean;
  lwfDeducted?: boolean;
  discontinuedDate?: string; // YYYY-MM-DD
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Leave';

export interface AttendanceRecord {
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  punchIn?: string; // "HH:MM"
  punchOut?: string; // "HH:MM"
}

export interface DayPayrollDetails {
  date: string;
  isSunday: boolean;
  status: AttendanceStatus;
  punchIn?: string;
  punchOut?: string;
  hoursWorked: number;
  actualWorkingHours?: number; // for Staff, excluding lunch break
  dailyWage: number;
  lateMinutes: number;
  lateDeduction: number;
  underworkDeduction?: number; // half-day or short-day deduction
  overtimeBonus: number;
  netPay: number;
  explanation: string;
}

export interface MonthlyPayrollSummary {
  employeeId: string;
  employeeName: string;
  employeeType: EmployeeType;
  basicSalary: number;
  oneDayPay: number;
  hourlyWage: number;
  
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  daysDiscontinued?: number;
  
  totalHoursWorked: number;
  totalLateMinutes: number;
  totalLateDeductions: number;
  totalUnderworkDeductions?: number;
  totalOvertimeBonuses: number;
  
  leaveDeductions: number; // from leaves > 1.5 days
  originalLeaveDeductions?: number;
  isLeaveDeductionOverridden?: boolean;
  adjustedHours?: number;
  adjustedHoursPay?: number;
  finalPayableSalary: number;
  
  esiDeduction: number;
  pfDeduction: number;
  lwfDeduction: number;
  advanceAmount?: number;
  netTakeHome: number;
  
  dailyDetails: DayPayrollDetails[];
}

export interface DeletedEmployeeLog {
  id: string;
  name: string;
  type: EmployeeType;
  deletedAt: string;
  basicSalary: number;
}

