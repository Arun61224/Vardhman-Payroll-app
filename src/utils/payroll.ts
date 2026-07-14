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

// Calculate lunch overlap in hours (between 13:00 and 14:00)
export function calculateLunchOverlap(punchIn: string, punchOut: string): number {
  const inMins = timeToMinutes(punchIn);
  const outMins = timeToMinutes(punchOut);
  if (outMins <= inMins) return 0;
  
  const lunchStart = 780; // 13:00 (1 PM)
  const lunchEnd = 840;   // 14:00 (2 PM)
  
  const overlap = Math.max(0, Math.min(outMins, lunchEnd) - Math.max(inMins, lunchStart));
  return overlap / 60;
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
  const hourlyWage = oneDayPay / 8;

  let hoursWorked = 0;
  let actualWorkingHours = 0;
  let underworkDeduction = 0;
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
      actualWorkingHours: 0,
      dailyWage: 0,
      lateMinutes: 0,
      lateDeduction: 0,
      underworkDeduction: 0,
      overtimeBonus: 0,
      netPay: sunday ? oneDayPay : 0,
      explanation,
    };
  }

  if (status === 'Leave') {
    explanation = sunday ? 'Sunday (Weekly Off)' : 'Leave Applied';
    return {
      date,
      isSunday: sunday,
      status,
      hoursWorked: 0,
      actualWorkingHours: 0,
      dailyWage: 0,
      lateMinutes: 0,
      lateDeduction: 0,
      underworkDeduction: 0,
      overtimeBonus: 0,
      netPay: sunday ? oneDayPay : 0,
      explanation,
    };
  }

  // Employee is Present
  if (punchIn && punchIn !== '-' && punchOut && punchOut !== '-') {
    hoursWorked = calculateHoursWorked(punchIn, punchOut);
    actualWorkingHours = hoursWorked;
    
    let lunchOverlap = 0;
    if (type === 'Staff') {
      lunchOverlap = calculateLunchOverlap(punchIn, punchOut);
      actualWorkingHours = Math.max(0, hoursWorked - lunchOverlap);
    }
    
    // 1. Overtime Calculation:
    const startMins = timeToMinutes(standardShiftStart);
    const shiftEndMins = startMins + 540; // 5:00 PM (17:00) if shift start is 8:00 AM
    const outMins = timeToMinutes(punchOut);
    const inMins = timeToMinutes(punchIn);
    const extraMins = Math.max(0, outMins - shiftEndMins);

    if (type === 'Staff') {
      // Staff: If completed 3hr (25min grace time, i.e. extraMins >= 155 mins) working after working hours, add ₹100 flat bonus
      if (extraMins >= 155) {
        overtimeBonus = 100;
      }
    } else {
      // Labour:
      if (!sunday) {
        // Weekdays: Any work before standardShiftStart or after shiftEndMins is paid extra hourly.
        // 35 minutes or more rounds up to a full hour.
        const extraMinsBefore = Math.max(0, startMins - inMins);
        const extraMinsAfter = Math.max(0, outMins - shiftEndMins);

        let extraHoursBefore = 0;
        if (extraMinsBefore > 0) {
          const fullHoursBefore = Math.floor(extraMinsBefore / 60);
          const remainingMinsBefore = extraMinsBefore % 60;
          extraHoursBefore = fullHoursBefore;
          if (remainingMinsBefore >= 35) {
            extraHoursBefore += 1;
          }
        }

        let extraHoursAfter = 0;
        if (extraMinsAfter > 0) {
          const fullHoursAfter = Math.floor(extraMinsAfter / 60);
          const remainingMinsAfter = extraMinsAfter % 60;
          extraHoursAfter = fullHoursAfter;
          if (remainingMinsAfter >= 35) {
            extraHoursAfter += 1;
          }
        }

        const totalExtraHours = extraHoursBefore + extraHoursAfter;
        if (totalExtraHours > 0) {
          overtimeBonus = Number((totalExtraHours * hourlyWage).toFixed(2));
        }

        // Plus, 100rs bonus extra for completing 3hr (25min grace time, i.e. extraMinsAfter >= 155 mins) working after working hours.
        if (extraMinsAfter >= 155) {
          overtimeBonus += 100;
        }
      } else {
        // Sunday: If completed 3hr (25min grace time, i.e. extraMins >= 155 mins) working after working hours, add ₹100 flat bonus
        if (extraMins >= 155) {
          overtimeBonus = 100;
        }
      }
    }

    // 2. Late Entry Calculation:
    // Grace period: Staff = 35 mins, Labour = 30 mins
    const gracePeriod = type === 'Staff' ? 35 : 30;
    const actualInMins = timeToMinutes(punchIn);

    if (actualInMins > startMins) {
      lateMinutes = actualInMins - startMins;
      if (lateMinutes > gracePeriod) {
        if (type === 'Staff') {
          // "35min bs subha entry k liye h usse jyada hua to subha hi 1hr kt jaega"
          // Exceeded grace period, deduct 1 hour or more (ceil to the next hour)
          lateDeduction = Math.ceil(lateMinutes / 60) * hourlyWage;
        } else {
          // Labour: Exceeded grace period, deduct standard hourly rate for the complete time missed
          lateDeduction = (lateMinutes / 60) * hourlyWage;
        }
      }
    }

    // Underwork deduction for both Staff and Labour on Weekdays
    let underworkWorkedHours = type === 'Staff' ? actualWorkingHours : hoursWorked;
    let underworkMissedHours = 0;
    if (!sunday) {
      // Lunch starts 4 hours after shift start
      const lunchStartMins = startMins + 240;
      // Shift end is 9 hours after shift start
      const endMins = startMins + 540;

      // Apply late grace period (30m for Labour, 35m for Staff) to effective input minutes for underwork
      let effectiveInMinsForUnderwork = actualInMins;
      if (actualInMins > startMins && (actualInMins - startMins) <= gracePeriod) {
        effectiveInMinsForUnderwork = startMins;
      }

      // Apply 10-minute grace period to half-day or shift end boundary
      let effectiveOutMinsForUnderwork = outMins;
      if (outMins >= (lunchStartMins - 10) && outMins < lunchStartMins) {
        effectiveOutMinsForUnderwork = lunchStartMins;
      } else if (outMins >= (endMins - 10) && outMins < endMins) {
        effectiveOutMinsForUnderwork = endMins;
      }

      if (outMins <= lunchStartMins) {
        // Left at or before lunch start -> Deduct based on actual hours missed from the 8-hour workday
        const effectiveWorkedMins = Math.max(0, effectiveOutMinsForUnderwork - effectiveInMinsForUnderwork);
        underworkWorkedHours = effectiveWorkedMins / 60;
        const missedMinutes = Math.max(0, 480 - (underworkWorkedHours * 60));
        underworkMissedHours = Math.ceil(missedMinutes / 60);
        underworkDeduction = Math.min(oneDayPay, underworkMissedHours * hourlyWage);
      } else {
        // Left after lunch start -> Early exit hourly penalty (excluding unpaid 1h lunch if missed)
        const earlyMinutes = Math.max(0, endMins - effectiveOutMinsForUnderwork);
        if (earlyMinutes > 10) {
          const lunchOverlapMins = Math.max(0, Math.min(endMins, 840) - Math.max(effectiveOutMinsForUnderwork, 780));
          const adjustedEarlyMinutes = Math.max(0, earlyMinutes - lunchOverlapMins);
          underworkMissedHours = Math.ceil(adjustedEarlyMinutes / 60);
          underworkDeduction = underworkMissedHours * hourlyWage;
        } else {
          underworkDeduction = 0;
        }
      }
    }

    // Check if employee worked around 4 hours net (half-day work: between 3.5 and 4.5 hours net)
    const currentLunchOverlap = calculateLunchOverlap(punchIn, punchOut);
    const netWorkedHours = hoursWorked - currentLunchOverlap;
    const isHalfDay = !sunday && (netWorkedHours >= 3.5 && netWorkedHours <= 4.5);

    if (isHalfDay) {
      lateDeduction = 0;
      underworkDeduction = oneDayPay / 2;
    }

    // 3. Sunday Pay Calculation:
    if (sunday) {
      if (type === 'Labour') {
        if (hoursWorked > 0) {
          // Apply 30-minute late grace period and 10-minute early exit grace period on Sunday
          const startMins = timeToMinutes(standardShiftStart);
          const endMins = startMins + 540; // 5:00 PM (17:00) if shift start is 8:00 AM
          
          const inMins = timeToMinutes(punchIn);
          const outMins = timeToMinutes(punchOut);
          
          let effectiveInMins = inMins;
          if (inMins > startMins && (inMins - startMins) <= 30) {
            effectiveInMins = startMins; // Within 30m grace: treat as shift start
          }
          
          let effectiveOutMins = outMins;
          if (outMins >= (endMins - 10) && outMins < endMins) {
            effectiveOutMins = endMins; // Within 10m early exit grace: treat as shift end
          }
          
          const adjustedSundayHours = Math.max(0, effectiveOutMins - effectiveInMins) / 60;
          
          // Round actual hours worked on Sunday with a 35-minute grace period
          const fullHoursOnSunday = Math.floor(adjustedSundayHours);
          const remainingMinsOnSunday = Math.round((adjustedSundayHours - fullHoursOnSunday) * 60);
          let creditedHours = fullHoursOnSunday;
          if (remainingMinsOnSunday >= 35) {
            creditedHours += 1;
          }
          // On Sunday, Labour gets 1 extra hour of pay (e.g., 8am-5pm = 9h worked + 1h extra = 10h paid)
          const totalPaidHours = creditedHours + 1;
          dailyWage = totalPaidHours * hourlyWage;
          
          const timeStr = formatHoursAndMinutes(hoursWorked);
          explanation = `Sunday Pay: Worked ${timeStr} (${creditedHours}h credited based on grace + 1h extra = ${totalPaidHours}h paid), paid ₹${hourlyWage.toFixed(2)}/h.`;
          
          if (overtimeBonus > 0) {
            explanation += ` Plus Overtime Bonus (+₹${overtimeBonus.toFixed(0)}).`;
          }
        } else {
          dailyWage = 0;
          explanation = `Sunday: Absent.`;
        }
      } else {
        // Staff: Paid strictly on hourly basis for Sundays based on actualWorkingHours (excluding lunch)
        dailyWage = actualWorkingHours * hourlyWage;
        explanation = `Sunday Overtime: Worked ${formatHoursAndMinutes(actualWorkingHours)} (Excl. ${formatHoursAndMinutes(lunchOverlap)} lunch), paid strictly Hourly.`;
      }
      
      // Net pay for Sunday = Extra daily wage + Overtime Bonus - Late Deduction + oneDayPay (paid weekly off)
      netPay = oneDayPay + dailyWage + overtimeBonus - lateDeduction;
    } else {
      // Weekday / Regular Working Day
      // Basic salary already covers standard weekdays.
      // So the weekday daily earnings component is covered, but we track late deductions, underwork penalties, and overtime bonuses.
      dailyWage = oneDayPay;
      netPay = dailyWage + overtimeBonus - lateDeduction - underworkDeduction;
      
      if (isHalfDay) {
        explanation = `Present. Worked ${formatHoursAndMinutes(hoursWorked)}${currentLunchOverlap > 0 ? ` (Excl. ${formatHoursAndMinutes(currentLunchOverlap)} lunch)` : ''}. Half-day worked (around 4 hours net): deducted half-day salary (-₹${underworkDeduction.toFixed(0)}).`;
      } else {
        if (type === 'Staff') {
          explanation = `Present. Worked ${formatHoursAndMinutes(actualWorkingHours)} (Excl. ${formatHoursAndMinutes(lunchOverlap)} lunch).`;
        } else {
          explanation = `Present. Worked ${formatHoursAndMinutes(hoursWorked)}.`;
        }

        if (underworkDeduction > 0) {
          const outMins = timeToMinutes(punchOut);
          const lunchStartMins = startMins + 240;
          if (outMins <= lunchStartMins) {
            if (underworkMissedHours === 4) {
              explanation += ` Half-day penalty applied (-₹${underworkDeduction.toFixed(0)}).`;
            } else {
              explanation += ` Underwork penalty applied (-₹${underworkDeduction.toFixed(0)}: ${underworkMissedHours}h missed).`;
            }
          } else {
            explanation += ` Early exit penalty applied (-₹${underworkDeduction.toFixed(0)}: ${underworkMissedHours}h early).`;
          }
        } else {
          const outMins = timeToMinutes(punchOut);
          const lunchStartMins = startMins + 240;
          const endMins = startMins + 540;
          if (outMins > lunchStartMins && outMins < endMins) {
            const earlyMinutes = endMins - outMins;
            explanation += ` Early exit by ${earlyMinutes}m (Within 10m grace: No deduction).`;
          }
        }
        
        if (lateMinutes > 0) {
          if (lateMinutes > gracePeriod) {
            if (type === 'Staff') {
              const lateHours = Math.ceil(lateMinutes / 60);
              explanation += ` Late by ${lateMinutes}m (Grace ${gracePeriod}m exceeded: -₹${lateDeduction.toFixed(2)} [${lateHours}h penalty]).`;
            } else {
              explanation += ` Late by ${lateMinutes}m (Grace ${gracePeriod}m exceeded: -₹${lateDeduction.toFixed(2)}).`;
            }
          } else {
            explanation += ` Late by ${lateMinutes}m (Within Grace ${gracePeriod}m: No deduction).`;
          }
        }
      }
      if (overtimeBonus > 0) {
        if (type === 'Labour' && !sunday) {
          const inMins = timeToMinutes(punchIn);
          const outMins = timeToMinutes(punchOut);
          const startMins = timeToMinutes(standardShiftStart);
          const shiftEndMins = startMins + 540;
          
          const extraMinsBefore = Math.max(0, startMins - inMins);
          const extraMinsAfter = Math.max(0, outMins - shiftEndMins);
          
          let extraHoursBefore = Math.floor(extraMinsBefore / 60);
          if (extraMinsBefore % 60 >= 35) {
            extraHoursBefore += 1;
          }
          
          let extraHoursAfter = Math.floor(extraMinsAfter / 60);
          if (extraMinsAfter % 60 >= 35) {
            extraHoursAfter += 1;
          }
          
          const otParts = [];
          if (extraHoursBefore > 0) {
            otParts.push(`Before ${minutesToTime(startMins)}: worked ${formatHoursAndMinutes(extraMinsBefore / 60)} extra (${extraHoursBefore}h credited based on 35m grace)`);
          }
          if (extraHoursAfter > 0) {
            otParts.push(`After 5:00 PM: worked ${formatHoursAndMinutes(extraMinsAfter / 60)} extra (${extraHoursAfter}h credited based on 35m grace)`);
          }
          
          const totalOTPay = (extraHoursBefore + extraHoursAfter) * hourlyWage;
          const has100Bonus = extraMinsAfter >= 155;
          
          explanation += ` Overtime: ${otParts.join(', ')} (+₹${totalOTPay.toFixed(0)}${has100Bonus ? ' + ₹100 OT Bonus' : ''}).`;
        } else {
          explanation += ` Overtime Bonus (+₹${overtimeBonus.toFixed(0)}).`;
        }
      }

      // Append daily net payable amount
      explanation += ` Net Payable: ₹${netPay.toFixed(0)}.`;
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
    actualWorkingHours,
    dailyWage,
    lateMinutes,
    lateDeduction,
    underworkDeduction,
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
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  overrideLeaveDeduction?: number,
  overrideAdjustedHours?: number,
  advanceAmount: number = 0
): MonthlyPayrollSummary {
  const { basicSalary, type } = employee;
  const oneDayPay = basicSalary / 30;
  const hourlyWage = oneDayPay / 8;

  // Find all dates in the selected month
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyDetails: DayPayrollDetails[] = [];

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLeave = 0;

  let totalHoursWorked = 0;
  let totalLateMinutes = 0;
  let totalLateDeductions = 0;
  let totalUnderworkDeductions = 0;
  let totalOvertimeBonuses = 0;
  let totalSundayPay = 0;
  let daysDiscontinued = 0;

  for (let day = 1; day <= totalDaysInMonth; day++) {
    // Format date as YYYY-MM-DD
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const sunday = isSunday(dateStr);

    if (employee.discontinuedDate && dateStr > employee.discontinuedDate) {
      daysDiscontinued++;
      dailyDetails.push({
        date: dateStr,
        isSunday: sunday,
        status: 'Absent',
        hoursWorked: 0,
        dailyWage: 0,
        lateMinutes: 0,
        lateDeduction: 0,
        overtimeBonus: 0,
        netPay: 0,
        explanation: 'Discontinued (No Pay)',
      });
      continue;
    }

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
          totalUnderworkDeductions += details.underworkDeduction || 0;
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
          netPay: oneDayPay,
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
  // "sunday k alawa jo bhi chutti mare tu usko deduct krde"
  // Allowed: 0 days by default (meaning any weekday leave or absence is deducted at 1 Day Pay rate)
  const allowedLeaves = 0;
  const unpaidLeaves = Math.max(0, daysLeave - allowedLeaves);
  const calculatedLeaveDeductions = unpaidLeaves * oneDayPay;
  const calculatedAbsentDeductions = daysAbsent * oneDayPay;
  const calculatedDiscontinuedDeductions = daysDiscontinued * oneDayPay;
  const defaultLeaveDeductions = calculatedLeaveDeductions + calculatedAbsentDeductions + calculatedDiscontinuedDeductions;

  // Apply manual override if provided
  const isOverridden = overrideLeaveDeduction !== undefined;
  const finalLeaveDeductions = isOverridden ? overrideLeaveDeduction : defaultLeaveDeductions;

  // Apply custom hours adjustment (add or deduct hours) - Only applicable for Staff
  const adjustedHours = type === 'Staff' ? (overrideAdjustedHours || 0) : 0;
  const adjustedHoursPay = type === 'Staff' ? Number((adjustedHours * hourlyWage).toFixed(2)) : 0;

  // Final Payable Salary Formula:
  // Final = Basic Salary - Leave Deductions - Late Deductions - Underwork Deductions + Overtime Bonuses + Sunday Overtime Pay + Adjusted Hours Pay
  const finalPayableSalary = Math.max(
    0,
    basicSalary - finalLeaveDeductions - totalLateDeductions - totalUnderworkDeductions + totalOvertimeBonuses + totalSundayPay + adjustedHoursPay
  );

  const esiDeduction = employee.esiDeducted ? Number((finalPayableSalary * 0.0075).toFixed(2)) : 0;
  const pfDeduction = employee.pfDeducted ? Number((finalPayableSalary * 0.12).toFixed(2)) : 0;
  const lwfDeduction = employee.lwfDeducted ? Math.min(35, Number((finalPayableSalary * 0.002).toFixed(2))) : 0;
  const netTakeHomeBeforeAdvance = Math.max(0, Number((finalPayableSalary - esiDeduction - pfDeduction - lwfDeduction).toFixed(2)));
  const netTakeHome = Math.max(0, Number((netTakeHomeBeforeAdvance - advanceAmount).toFixed(2)));

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
    daysDiscontinued,
    
    totalHoursWorked,
    totalLateMinutes,
    totalLateDeductions,
    totalUnderworkDeductions,
    totalOvertimeBonuses,
    
    leaveDeductions: finalLeaveDeductions,
    originalLeaveDeductions: defaultLeaveDeductions,
    isLeaveDeductionOverridden: isOverridden,
    adjustedHours,
    adjustedHoursPay,
    finalPayableSalary,
    
    esiDeduction,
    pfDeduction,
    lwfDeduction,
    advanceAmount,
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

// Convert decimal hours into a friendly readable string: "Xh Ym"
export function formatHoursAndMinutes(hours: number): string {
  if (isNaN(hours) || hours <= 0) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m > 0) {
    return `${m}m`;
  }
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
