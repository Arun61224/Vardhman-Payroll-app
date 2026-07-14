import React, { useState } from 'react';
import { usePayroll } from '../context/PayrollContext';
import { Employee, EmployeeType } from '../types';
import { Plus, Edit2, Trash2, Users, Briefcase, IndianRupee, Clock, X, UserPlus, Check, Sparkles, Save, FileSpreadsheet, Upload, RotateCcw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { normalizeTime } from '../utils/payroll';

export const EmployeeDashboard: React.FC = () => {
  const { employees, addEmployee, updateEmployee, bulkUpdateEmployees, deleteEmployee, deleteEmployees } = usePayroll();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<EmployeeType>('Staff');
  const [basicSalary, setBasicSalary] = useState('');
  const [standardShiftStart, setStandardShiftStart] = useState('08:00');
  const [esiDeducted, setEsiDeducted] = useState(true);
  const [pfDeducted, setPfDeducted] = useState(true);
  const [lwfDeducted, setLwfDeducted] = useState(true);
  const [discontinuedDate, setDiscontinuedDate] = useState('');

  // Bulk Edit States
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkEmployeesState, setBulkEmployeesState] = useState<Employee[]>([]);

  // CSV Import States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<(Omit<Employee, 'id'> & { id?: string })[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  
  // Validation / feedback states
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<{ id: string; name: string } | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Sync selection in case employees list changes
  React.useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => employees.some((e) => e.id === id)));
  }, [employees]);

  const startBulkEdit = () => {
    setBulkEmployeesState(JSON.parse(JSON.stringify(employees)));
    setIsBulkEditMode(true);
  };

  const cancelBulkEdit = () => {
    setIsBulkEditMode(false);
    setBulkEmployeesState([]);
  };

  const saveBulkEdit = () => {
    const hasInvalid = bulkEmployeesState.some(e => !e.name.trim() || isNaN(e.basicSalary) || e.basicSalary <= 0);
    if (hasInvalid) {
      showToast('Please verify that all names are provided and salaries are positive.');
      return;
    }
    bulkUpdateEmployees(bulkEmployeesState);
    setIsBulkEditMode(false);
    showToast('All employee contracts updated in bulk!');
  };

  const handleBulkFieldChange = (index: number, field: keyof Employee, value: any) => {
    setBulkEmployeesState(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      return copy;
    });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      processCsvContent(text);
    };
    reader.readAsText(file);
  };

  const processCsvContent = (text: string) => {
    try {
      setCsvError(null);
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      if (lines.length <= 1) {
        setCsvError('The CSV file is empty or missing data rows.');
        return;
      }

      const headersLine = lines[0].toLowerCase();
      const hasIdColumn = headersLine.includes('id') || headersLine.includes('code');

      const rows = lines.slice(1).map((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        
        let id: string | undefined = undefined;
        let name = '';
        let typeStr = 'Staff';
        let salaryStr = '';
        let shiftStr = '08:00';
        let esiStr = 'yes';
        let pfStr = 'yes';
        let lwfStr = 'yes';

        if (hasIdColumn) {
          if (parts.length < 4) {
            throw new Error(`Row ${idx + 2} has insufficient columns. Need at least ID, Name, Type, Salary.`);
          }
          id = parts[0] || undefined;
          name = parts[1];
          typeStr = parts[2] || 'Staff';
          salaryStr = parts[3];
          shiftStr = parts[4] || '08:00';
          esiStr = parts[5];
          pfStr = parts[6];
          lwfStr = parts[7];
        } else {
          if (parts.length < 3) {
            throw new Error(`Row ${idx + 2} has insufficient columns. Need at least Name, Type, Salary.`);
          }
          name = parts[0];
          typeStr = parts[1] || 'Staff';
          salaryStr = parts[2];
          shiftStr = parts[3] || '08:00';
          esiStr = parts[4];
          pfStr = parts[5];
          lwfStr = parts[6];
        }

        const type: EmployeeType = typeStr.toLowerCase().includes('labour') ? 'Labour' : 'Staff';
        const basicSalary = Math.round(Number(salaryStr));
        if (isNaN(basicSalary) || basicSalary <= 0) {
          throw new Error(`Row ${idx + 2} has invalid basic salary: "${salaryStr}". Must be a positive number.`);
        }

        const standardShiftStart = normalizeTime(shiftStr);
        const esiDeducted = esiStr ? ['yes', 'true', '1', 'y', 'active'].includes(esiStr.toLowerCase()) : true;
        const pfDeducted = pfStr ? ['yes', 'true', '1', 'y', 'active'].includes(pfStr.toLowerCase()) : true;
        const lwfDeducted = lwfStr ? ['yes', 'true', '1', 'y', 'active'].includes(lwfStr.toLowerCase()) : true;

        return {
          id,
          name,
          type,
          basicSalary,
          standardShiftStart,
          esiDeducted,
          pfDeducted,
          lwfDeducted
        };
      });

      setCsvPreview(rows);
    } catch (err: any) {
      setCsvError(err.message || 'Error parsing CSV file. Please match the template structure.');
      setCsvPreview([]);
    }
  };

  const importCsvEmployees = () => {
    if (csvPreview.length === 0) return;
    
    // Batch add them
    csvPreview.forEach(emp => {
      addEmployee(emp);
    });

    setIsCsvModalOpen(false);
    setCsvText('');
    setCsvPreview([]);
    showToast(`Bulk imported ${csvPreview.length} employees successfully.`);
  };

  const downloadEmployeeTemplate = () => {
    const headers = 'EmployeeID,Name,Type,BasicSalary,ShiftStart,ESIDeducted,PFDeducted,LWFDeducted\n';
    const row1 = 'EMP001,Harish Verma,Staff,32000,08:30,Yes,Yes,Yes\n';
    const row2 = 'EMP002,Raju Yadav,Labour,18500,08:00,Yes,No,Yes\n';
    const row3 = 'EMP003,Suman Sharma,Staff,28000,09:00,Yes,Yes,No\n';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + row1 + row2 + row3);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'employee_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Employee CSV template downloaded!');
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setName('');
    setType('Staff');
    setBasicSalary('');
    setStandardShiftStart('08:00');
    setEsiDeducted(true);
    setPfDeducted(true);
    setLwfDeducted(true);
    setDiscontinuedDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setType(emp.type);
    setBasicSalary(emp.basicSalary.toString());
    setStandardShiftStart(emp.standardShiftStart);
    setEsiDeducted(emp.esiDeducted ?? false);
    setPfDeducted(emp.pfDeducted ?? false);
    setLwfDeducted(emp.lwfDeducted ?? false);
    setDiscontinuedDate(emp.discontinuedDate || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !basicSalary || isNaN(Number(basicSalary)) || Number(basicSalary) <= 0) {
      showToast('Please provide a valid name and positive basic salary.');
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      basicSalary: Math.round(Number(basicSalary)),
      standardShiftStart,
      esiDeducted,
      pfDeducted,
      lwfDeducted,
      discontinuedDate: discontinuedDate || undefined,
    };

    if (editingEmployee) {
      updateEmployee({ ...payload, id: editingEmployee.id });
      showToast(`Employee ${payload.name} updated successfully.`);
    } else {
      addEmployee(payload);
      showToast(`Employee ${payload.name} added successfully.`);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, empName: string) => {
    setDeletingEmployee({ id, name: empName });
  };

  // KPIs
  const totalEmployees = employees.length;
  const staffCount = employees.filter((e) => e.type === 'Staff').length;
  const labourCount = employees.filter((e) => e.type === 'Labour').length;
  const totalPayrollBudget = employees.reduce((acc, e) => acc + e.basicSalary, 0);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-slate-800"
          >
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employee Directory</h1>
          <p className="text-sm text-slate-500">Manage organizational members, employment types, and salary contracts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isBulkEditMode ? (
            <>
              <button
                onClick={saveBulkEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm rounded-xl flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                Save Bulk Changes
              </button>
              <button
                onClick={cancelBulkEdit}
                className="px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all rounded-xl flex items-center gap-1.5 border border-rose-100"
              >
                <X className="h-4 w-4" />
                Cancel Bulk Edit
              </button>
            </>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm rounded-xl flex items-center gap-1.5 border border-rose-500"
                  title="Remove selected employees in bulk"
                >
                  <Trash2 className="h-3.5 w-3.5 animate-pulse" />
                  Delete Selected ({selectedIds.length})
                </button>
              )}
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-xl flex items-center gap-1.5 border border-indigo-100"
              >
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </button>
              <button
                onClick={startBulkEdit}
                className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-xl flex items-center gap-1.5 border border-indigo-100"
                title="Edit all employee contracts at once"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Bulk Edit
              </button>
              <button
                onClick={openAddModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm rounded-xl flex items-center gap-1.5"
              >
                <UserPlus className="h-4 w-4" />
                Add Employee
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <h3 className="text-2xl font-bold text-slate-800">{totalEmployees}</h3>
            <span className="text-xs text-slate-500">Active personnel</span>
          </div>
          <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 border border-slate-100">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Staff Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Office Staff</span>
            <h3 className="text-2xl font-bold text-slate-800">{staffCount}</h3>
            <span className="text-xs text-indigo-600 font-medium bg-indigo-50/50 px-2 py-0.5 rounded-full">35m Grace Period</span>
          </div>
          <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100/50">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        {/* Labour Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Technical Labour</span>
            <h3 className="text-2xl font-bold text-slate-800">{labourCount}</h3>
            <span className="text-xs text-amber-600 font-medium bg-amber-50/50 px-2 py-0.5 rounded-full">30m Grace Period</span>
          </div>
          <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100/50">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Monthly Basic Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Base Payroll Budget</span>
            <h3 className="text-2xl font-bold text-slate-800">₹{totalPayrollBudget.toLocaleString('en-IN')}</h3>
            <span className="text-xs text-slate-500">Excluding OT/late penalties</span>
          </div>
          <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100/50">
            <IndianRupee className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Employee Grid/Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No employees registered</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Get started by onboarding your first company staff member or field labour technician.</p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" /> Add Employee
            </button>
          </div>
        ) : isBulkEditMode ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">ID</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Employee Name</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Category</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Monthly Basic (₹)</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Shift Start</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statutory Deductions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bulkEmployeesState.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3 px-6 text-sm font-mono text-slate-600 font-semibold">{emp.id}</td>
                    <td className="py-3 px-6">
                      <input
                        type="text"
                        value={emp.name}
                        onChange={(e) => handleBulkFieldChange(idx, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-semibold text-slate-800 bg-white"
                        placeholder="Name"
                      />
                    </td>
                    <td className="py-3 px-6">
                      <select
                        value={emp.type}
                        onChange={(e) => handleBulkFieldChange(idx, 'type', e.target.value as EmployeeType)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-semibold text-slate-700 bg-white"
                      >
                        <option value="Staff">Staff</option>
                        <option value="Labour">Labour</option>
                      </select>
                    </td>
                    <td className="py-3 px-6">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">₹</span>
                        <input
                          type="number"
                          value={emp.basicSalary || ''}
                          onChange={(e) => handleBulkFieldChange(idx, 'basicSalary', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full pl-6 pr-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono font-bold text-slate-800 bg-white"
                          placeholder="Salary"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <input
                        type="time"
                        value={emp.standardShiftStart}
                        onChange={(e) => handleBulkFieldChange(idx, 'standardShiftStart', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono text-slate-700 bg-white"
                      />
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex flex-wrap items-center gap-3 select-none">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={emp.esiDeducted ?? false}
                            onChange={(e) => handleBulkFieldChange(idx, 'esiDeducted', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>ESI</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={emp.pfDeducted ?? false}
                            onChange={(e) => handleBulkFieldChange(idx, 'pfDeducted', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>PF</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={emp.lwfDeducted ?? false}
                            onChange={(e) => handleBulkFieldChange(idx, 'lwfDeducted', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>LWF</span>
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12 text-center select-none">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.length === employees.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(employees.map((emp) => emp.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee Name</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Category</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Salary (Monthly)</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift Start</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statutory Coverages</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const oneDayWage = Math.round(emp.basicSalary / 30);
                  const hourlyWage = Math.round(oneDayWage / 9);
                  const isChecked = selectedIds.includes(emp.id);
                  return (
                    <tr key={emp.id} className={`hover:bg-slate-50/40 transition-colors ${isChecked ? 'bg-indigo-50/15' : ''}`}>
                      <td className="py-4 px-4 text-center select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, emp.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== emp.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-6 text-sm font-mono text-slate-600 font-medium">{emp.id}</td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">{emp.name}</div>
                        {emp.discontinuedDate ? (
                          <div className="text-xs font-semibold text-rose-600">Discontinued since {emp.discontinuedDate}</div>
                        ) : (
                          <div className="text-xs text-slate-400">Regular Contract</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            emp.type === 'Staff'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50'
                              : 'bg-amber-50 text-amber-700 border border-amber-100/50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.type === 'Staff' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                          {emp.type}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">₹{emp.basicSalary.toLocaleString('en-IN')}</div>
                        <div className="text-xs text-slate-400">₹{oneDayWage}/day · ₹{hourlyWage}/hr</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 font-mono">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {emp.standardShiftStart}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${emp.esiDeducted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-100 opacity-60'}`}>
                            ESI (0.75%)
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${emp.pfDeducted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-100 opacity-60'}`}>
                            PF (12%)
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${emp.lwfDeducted ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100 opacity-60'}`}>
                            LWF (0.2%)
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition rounded-lg"
                            title="Edit Employee Contract"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id, emp.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition rounded-lg"
                            title="Remove Employee"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden z-10"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">
                  {editingEmployee ? 'Edit Employee Contract' : 'Onboard New Employee'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/55 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label htmlFor="emp-name" className="text-xs font-semibold text-slate-600">Employee Full Name</label>
                  <input
                    id="emp-name"
                    type="text"
                    required
                    placeholder="e.g. Satish Chandra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1">
                  <label htmlFor="emp-type" className="text-xs font-semibold text-slate-600 block">Category & Wage Contract</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setType('Staff')}
                      className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        type === 'Staff'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm font-semibold">Office Staff</span>
                      <span className="text-[10px] opacity-80">35m Grace Period</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('Labour')}
                      className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        type === 'Labour'
                          ? 'border-amber-600 bg-amber-50 text-amber-700'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm font-semibold">Technical Labour</span>
                      <span className="text-[10px] opacity-80">30m Grace Period</span>
                    </button>
                  </div>
                </div>

                {/* Basic Salary */}
                <div className="space-y-1">
                  <label htmlFor="emp-salary" className="text-xs font-semibold text-slate-600">Basic Monthly Salary (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                    <input
                      id="emp-salary"
                      type="number"
                      required
                      placeholder="e.g. 30000"
                      value={basicSalary}
                      onChange={(e) => setBasicSalary(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Daily rate and hourly pay will be derived automatically relative to a 30-day month.</p>
                </div>

                {/* Shift Start Time */}
                <div className="space-y-1">
                  <label htmlFor="emp-shift" className="text-xs font-semibold text-slate-600">Standard Shift Start Time</label>
                  <div className="relative">
                    <input
                      id="emp-shift"
                      type="time"
                      required
                      value={standardShiftStart}
                      onChange={(e) => setStandardShiftStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Late entry and deductions are calculated based on this reference time.</p>
                </div>

                {/* Statutory Deductions toggles */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 block">Statutory Coverages (Monthly)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEsiDeducted(!esiDeducted)}
                      className={`py-1.5 px-2 border rounded-xl flex items-center justify-center gap-1.5 transition text-xs font-semibold ${
                        esiDeducted
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={esiDeducted}
                        onChange={() => {}} // toggled by button click
                        className="pointer-events-none rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                      />
                      <span>ESI (0.75%)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPfDeducted(!pfDeducted)}
                      className={`py-1.5 px-2 border rounded-xl flex items-center justify-center gap-1.5 transition text-xs font-semibold ${
                        pfDeducted
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={pfDeducted}
                        onChange={() => {}} // toggled by button click
                        className="pointer-events-none rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                      />
                      <span>PF (12%)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLwfDeducted(!lwfDeducted)}
                      className={`py-1.5 px-2 border rounded-xl flex items-center justify-center gap-1.5 transition text-xs font-semibold ${
                        lwfDeducted
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={lwfDeducted}
                        onChange={() => {}} // toggled by button click
                        className="pointer-events-none rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                      />
                      <span>LWF (0.2%)</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight">These parameters govern if statutory deductions apply to this employee's payroll calculations.</p>
                </div>

                {/* Discontinuation Date (Optional) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="emp-discontinued" className="text-xs font-semibold text-slate-600">Discontinuation Date (Optional)</label>
                    {discontinuedDate && (
                      <button
                        type="button"
                        onClick={() => setDiscontinuedDate('')}
                        className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    id="emp-discontinued"
                    type="date"
                    value={discontinuedDate}
                    onChange={(e) => setDiscontinuedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono"
                  />
                  <p className="text-[10px] text-slate-400">If employee has left the company, set their last working day. Days and Sundays after this date will be permanently unpaid.</p>
                </div>

                {/* Footer buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition rounded-xl"
                  >
                    {editingEmployee ? 'Save Changes' : 'Register Employee'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV Import Modal */}
      <AnimatePresence>
        {isCsvModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCsvModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden z-10"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-indigo-600" />
                    Bulk Import Employees via CSV
                  </h3>
                  <p className="text-xs text-slate-500">Quickly onboard your workforce with standard contract parameters.</p>
                </div>
                <button
                  onClick={() => setIsCsvModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/55 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Format Instructions */}
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 text-xs text-indigo-950 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold block text-indigo-900 text-[13px]">Standard CSV Structure & Columns</span>
                    <button
                      type="button"
                      onClick={downloadEmployeeTemplate}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 text-[11px] font-semibold shadow-xs transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Template CSV
                    </button>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Ensure your CSV has headers and follows this exact column order:
                  </p>
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto select-all">
                    EmployeeID, Name, Type, BasicSalary, ShiftStart, ESIDeducted, PFDeducted, LWFDeducted
                    <br />
                    EMP001, Harish Verma, Staff, 32000, 08:30, Yes, Yes, Yes
                    <br />
                    EMP002, Raju Yadav, Labour, 18500, 08:00, Yes, No, Yes
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-indigo-700/80">
                    <span>• <strong>EmployeeID</strong>: Optional custom code (e.g. <code>EMP123</code>). Leave blank to auto-generate.</span>
                    <span>• <strong>ShiftStart</strong>: Shift start time (e.g., <code>08:00</code>, <code>09:30</code>) in 24hr format.</span>
                    <span>• <strong>Type</strong>: <code>Staff</code> or <code>Labour</code></span>
                    <span>• <strong>Deductions (ESI/PF/LWF)</strong>: <code>Yes</code>, <code>No</code>, <code>True</code>, or <code>False</code></span>
                  </div>
                </div>

                {/* File Uploader */}
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 transition rounded-2xl p-6 text-center relative bg-slate-50/30">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <FileSpreadsheet className="h-10 w-10 text-slate-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Click to select or drag & drop CSV file</span>
                      <span className="text-[10px] text-slate-400">Supported formats: standard comma-separated .csv files</span>
                    </div>
                  </div>
                </div>

                {/* Parsing Errors */}
                {csvError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl">
                    <strong>Error parsing file:</strong> {csvError}
                  </div>
                )}

                {/* Preview Panel */}
                {csvPreview.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Preview ({csvPreview.length} Employees Parsed)</span>
                      <button
                        onClick={() => { setCsvPreview([]); setCsvText(''); }}
                        className="text-[10px] text-rose-600 hover:underline font-bold"
                      >
                        Clear File
                      </button>
                    </div>
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-2.5 font-bold text-slate-600">ID</th>
                            <th className="p-2.5 font-bold text-slate-600">Name</th>
                            <th className="p-2.5 font-bold text-slate-600">Category</th>
                            <th className="p-2.5 font-bold text-slate-600">Basic Monthly</th>
                            <th className="p-2.5 font-bold text-slate-600">Shift Start</th>
                            <th className="p-2.5 font-bold text-slate-600">Coverages (ESI/PF/LWF)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {csvPreview.map((p, index) => (
                            <tr key={index} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-mono text-slate-600 font-bold">{p.id || <span className="text-slate-400 italic">Auto</span>}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{p.name}</td>
                              <td className="p-2.5 text-slate-600">{p.type}</td>
                              <td className="p-2.5 font-mono text-slate-700">₹{p.basicSalary.toLocaleString('en-IN')}</td>
                              <td className="p-2.5 text-slate-500">{p.standardShiftStart}</td>
                              <td className="p-2.5">
                                <div className="flex gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.esiDeducted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400'}`}>ESI</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.pfDeducted ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-400'}`}>PF</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.lwfDeducted ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400'}`}>LWF</span>
                                </div>
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
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={csvPreview.length === 0}
                  onClick={importCsvEmployees}
                  className={`px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition rounded-xl ${
                    csvPreview.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Confirm & Import {csvPreview.length > 0 ? `(${csvPreview.length} Employees)` : ''}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirm Modal */}
      <AnimatePresence>
        {deletingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingEmployee(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-10"
            >
              <div className="bg-rose-50 px-6 py-5 border-b-2 border-black flex items-center gap-3">
                <div className="h-10 w-10 bg-rose-100 border border-rose-300 rounded-xl flex items-center justify-center text-rose-600">
                  <Trash2 className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight text-lg">Remove Employee?</h3>
                  <p className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wider">CRITICAL DATA ACTIONS</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Are you absolutely sure you want to remove <strong className="text-black">{deletingEmployee.name}</strong> (<span className="font-mono text-xs font-bold text-slate-700">{deletingEmployee.id}</span>)?
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex gap-3">
                  <span className="text-base select-none">⚠️</span>
                  <div>
                    <span className="font-bold block text-amber-950 mb-0.5">Destructive Side-Effects</span>
                    <p className="leading-normal text-amber-800">
                      This will permanently purge this employee from the directory and delete all of their attendance records and wage calculations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t-2 border-black flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingEmployee(null)}
                  className="px-4 py-2 border-2 border-black bg-white hover:bg-slate-100 text-xs font-bold rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteEmployee(deletingEmployee.id);
                    showToast(`${deletingEmployee.name} has been deleted.`);
                    setDeletingEmployee(null);
                  }}
                  className="px-4 py-2 border-2 border-black bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Bulk Delete Confirm Modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-10"
            >
              <div className="bg-rose-50 px-6 py-5 border-b-2 border-black flex items-center gap-3">
                <div className="h-10 w-10 bg-rose-100 border border-rose-300 rounded-xl flex items-center justify-center text-rose-600">
                  <Trash2 className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight text-lg">Remove {selectedIds.length} Employees?</h3>
                  <p className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wider">BULK DATA PURGE</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Are you absolutely sure you want to remove the <strong className="text-black">{selectedIds.length} selected employees</strong>?
                </p>

                <div className="max-h-28 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 custom-scrollbar">
                  {selectedIds.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    return emp ? (
                      <div key={id} className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>{emp.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-md">{emp.id}</span>
                      </div>
                    ) : null;
                  })}
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex gap-3">
                  <span className="text-base select-none">⚠️</span>
                  <div>
                    <span className="font-bold block text-amber-950 mb-0.5">Destructive Side-Effects</span>
                    <p className="leading-normal text-amber-800">
                      This will permanently purge all selected employees from the directory and delete all of their attendance records and wage calculations. This is reversible by restoring logs individually.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t-2 border-black flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 border-2 border-black bg-white hover:bg-slate-100 text-xs font-bold rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  No, Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteEmployees(selectedIds);
                    showToast(`Successfully removed ${selectedIds.length} employees.`);
                    setSelectedIds([]);
                    setShowBulkDeleteConfirm(false);
                  }}
                  className="px-4 py-2 border-2 border-black bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Yes, Remove All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
