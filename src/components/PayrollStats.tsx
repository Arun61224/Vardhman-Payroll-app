import React, { useMemo } from 'react';
import { usePayroll } from '../context/PayrollContext';
import { calculateMonthlySummary } from '../utils/payroll';
import { IndianRupee, TrendingUp, TrendingDown, Star, AlertTriangle, Users, Award, ShieldAlert, BadgeCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const PayrollStats: React.FC = () => {
  const { employees, attendanceRecords, activeMonth, activeYear } = usePayroll();

  // Compute payroll summary data for the selected period
  const summaries = useMemo(() => {
    return employees.map((emp) => calculateMonthlySummary(emp, attendanceRecords, activeYear, activeMonth));
  }, [employees, attendanceRecords, activeYear, activeMonth]);

  // Aggregate stats
  const metrics = useMemo(() => {
    let totalBasic = 0;
    let totalFinal = 0;
    let totalLatePenalties = 0;
    let totalOTBonuses = 0;
    let totalLeavesDeduction = 0;
    
    let highestEarner = { name: 'None', salary: 0 };
    let highestLate = { name: 'None', mins: 0, penalty: 0 };
    let highestOT = { name: 'None', count: 0, bonus: 0 };

    summaries.forEach((s) => {
      totalBasic += s.basicSalary;
      totalFinal += s.finalPayableSalary;
      totalLatePenalties += s.totalLateDeductions;
      totalOTBonuses += s.totalOvertimeBonuses;
      totalLeavesDeduction += s.leaveDeductions;

      // Find highest earner
      if (s.finalPayableSalary > highestEarner.salary) {
        highestEarner = { name: s.employeeName, salary: s.finalPayableSalary };
      }

      // Find highest late minutes
      if (s.totalLateMinutes > highestLate.mins) {
        highestLate = { name: s.employeeName, mins: s.totalLateMinutes, penalty: s.totalLateDeductions };
      }

      // Find highest OT bonus counts (each OT day is ₹100, so divide by 100)
      const otCount = s.totalOvertimeBonuses / 100;
      if (otCount > highestOT.count) {
        highestOT = { name: s.employeeName, count: otCount, bonus: s.totalOvertimeBonuses };
      }
    });

    return {
      totalBasic,
      totalFinal,
      totalLatePenalties,
      totalOTBonuses,
      totalLeavesDeduction,
      highestEarner,
      highestLate,
      highestOT,
    };
  }, [summaries]);

  // Attendance ratio stats
  const attendanceRatio = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    summaries.forEach((s) => {
      presentCount += s.daysPresent;
      absentCount += s.daysAbsent;
      leaveCount += s.daysLeave;
    });

    const total = presentCount + absentCount + leaveCount;
    if (total === 0) return { present: 0, absent: 0, leave: 0 };

    return {
      present: (presentCount / total) * 100,
      absent: (absentCount / total) * 100,
      leave: (leaveCount / total) * 100,
      total,
      presentCount,
      absentCount,
      leaveCount,
    };
  }, [summaries]);

  // Max value helper for scaling bar charts
  const maxSalaryValue = useMemo(() => {
    const salaries = summaries.flatMap((s) => [s.basicSalary, s.finalPayableSalary]);
    return salaries.length > 0 ? Math.max(...salaries) : 10000;
  }, [summaries]);

  const maxPenaltyValue = useMemo(() => {
    const penalties = summaries.map((s) => s.totalLateDeductions);
    return penalties.length > 0 ? Math.max(...penalties, 500) : 500;
  }, [summaries]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payroll Analytics</h1>
        <p className="text-sm text-slate-500">Visual breakdown of wage structures, attendance metrics, and compliance logs.</p>
      </div>

      {/* Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Salary Variance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payroll Dispersal</span>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Net Pay Variance
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">
              ₹{metrics.totalFinal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Budget payout vs base: <strong className={metrics.totalFinal < metrics.totalBasic ? 'text-rose-600' : 'text-emerald-600'}>
                ₹{(metrics.totalFinal - metrics.totalBasic).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </strong>
            </div>
          </div>
          {/* Simple Variance bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 rounded-full" 
              style={{ width: `${Math.min(100, (metrics.totalFinal / (metrics.totalBasic || 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Penalties Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Penalties Retained</span>
            <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Deductions
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600">
              ₹{(metrics.totalLatePenalties + metrics.totalLeavesDeduction).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Late entry: <span className="font-bold text-slate-800">₹{metrics.totalLatePenalties.toFixed(0)}</span> · Leave exceed: <span className="font-bold text-slate-800">₹{metrics.totalLeavesDeduction.toFixed(0)}</span>
            </div>
          </div>
          {/* Deduction bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-rose-500 rounded-full" 
              style={{ width: `${Math.min(100, ((metrics.totalLatePenalties + metrics.totalLeavesDeduction) / (metrics.totalBasic || 1)) * 200)}%` }}
            />
          </div>
        </div>

        {/* Overtime Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overtime Payout</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Star className="h-3 w-3" />
              Bonuses
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">
              ₹{metrics.totalOTBonuses.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Approved hours: <span className="font-bold text-slate-800">₹100 flat bonus</span> per shift &ge; 12 hours.
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${Math.min(100, (metrics.totalOTBonuses / (metrics.totalBasic || 1)) * 300)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Custom Bar Graphs and Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Basic vs. Net Salary Payout (SVG Custom Bar Chart) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Salary Dispersal Comparison</h3>
            <p className="text-xs text-slate-500">Visual comparison of monthly base salary against final calculated net payout.</p>
          </div>

          <div className="space-y-4 pt-2">
            {summaries.map((s) => {
              const baseWidth = (s.basicSalary / maxSalaryValue) * 100;
              const netWidth = (s.finalPayableSalary / maxSalaryValue) * 100;

              return (
                <div key={s.employeeId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{s.employeeName} <span className="text-[10px] font-mono text-slate-400">({s.employeeType})</span></span>
                    <div className="space-x-3">
                      <span className="text-slate-400">Base: ₹{s.basicSalary.toLocaleString()}</span>
                      <span className="font-bold text-slate-950">Net: ₹{Math.round(s.finalPayableSalary).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                    {/* Base bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-slate-400 w-10">Contract</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-md overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-md" 
                          style={{ width: `${baseWidth}%` }}
                        />
                      </div>
                    </div>
                    {/* Net bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-slate-600 w-10">Payable</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-md overflow-hidden">
                        <div 
                          className={`h-full rounded-md ${s.finalPayableSalary < s.basicSalary ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${netWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 font-bold uppercase pt-2 border-t border-slate-50">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-indigo-500 rounded" />
              Base Salary Contract
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
              Net Pay (On-Time / Exceeded)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded" />
              Net Pay (Deductions applied)
            </div>
          </div>
        </div>

        {/* 2. Monthly Attendance Ratios (Circular Gauge SVG + KPI Details) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Organizational Attendance</h3>
            <p className="text-xs text-slate-500">Employee attendance breakdown for current month.</p>
          </div>

          {/* Large circular gauge */}
          <div className="relative flex items-center justify-center py-4">
            <svg className="w-36 h-36 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="72"
                cy="72"
                r="60"
                className="stroke-slate-100"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Present Circle */}
              <circle
                cx="72"
                cy="72"
                r="60"
                className="stroke-emerald-500"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 60}`}
                strokeDashoffset={`${2 * Math.PI * 60 * (1 - attendanceRatio.present / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-2xl font-black text-slate-800">{attendanceRatio.present.toFixed(1)}%</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Present Rate</div>
            </div>
          </div>

          {/* Simple list stats */}
          <div className="space-y-2 border-t border-slate-50 pt-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Present Logs
              </div>
              <span className="font-bold text-slate-800">{attendanceRatio.presentCount} Days</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Leaves Excused
              </div>
              <span className="font-bold text-slate-800">{attendanceRatio.leaveCount} Days</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Absent Weekdays
              </div>
              <span className="font-bold text-rose-600">{attendanceRatio.absentCount} Days</span>
            </div>
          </div>
        </div>

      </div>

      {/* Bento Grid Analytics & Achievements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Overtime Achiever */}
        <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/30 flex items-start gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl">
            <Award className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">Overtime Champion</span>
            <h4 className="font-bold text-slate-800">{metrics.highestOT.name}</h4>
            <p className="text-xs text-slate-600">Worked {metrics.highestOT.count} overtime shifts, earning an extra <strong className="text-indigo-700">₹{metrics.highestOT.bonus}</strong>.</p>
          </div>
        </div>

        {/* Highest Late Entry Minutes */}
        <div className="bg-rose-50/40 p-5 rounded-2xl border border-rose-100/30 flex items-start gap-4">
          <div className="p-3 bg-rose-600 text-white rounded-xl">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Late Retention Notice</span>
            <h4 className="font-bold text-slate-800">{metrics.highestLate.name}</h4>
            <p className="text-xs text-slate-600">Accumulated {metrics.highestLate.mins} late check-in minutes, incurring a penalty of <strong className="text-rose-700">₹{metrics.highestLate.penalty.toFixed(0)}</strong>.</p>
          </div>
        </div>

        {/* Leave Compliance */}
        <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100/30 flex items-start gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-xl">
            <BadgeCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">Policy Compliance</span>
            <h4 className="font-bold text-slate-800">Leave Utilization</h4>
            <p className="text-xs text-slate-600">Total leaves are safely monitored. Staff leave count stays within the <strong className="text-emerald-700">1.5 days allowance</strong>, while Labour remains at 0.</p>
          </div>
        </div>

      </div>

    </div>
  );
};
