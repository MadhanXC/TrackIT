"use client"

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Printer, 
  Filter,
  Settings2,
  MousePointerClick,
  RotateCcw,
  FileSpreadsheet
} from "lucide-react";
import { 
  format, 
  isWithinInterval, 
  startOfDay, 
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear
} from "date-fns";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, where } from "firebase/firestore";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8'];

export function ReportDialog() {
  const [open, setOpen] = React.useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  // Configuration State
  const [timeFrame, setTimeFrame] = React.useState("all");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setDateTo] = React.useState<string>("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  
  // Composition Toggle State (Defaults: Unchecked)
  const [includeLog, setIncludeLog] = React.useState(true);
  const [includeStats, setIncludeStats] = React.useState(false); 
  const [includeCharts, setIncludeCharts] = React.useState(false);

  // Granular Column Toggle State (Defaults: Checked)
  const [includeSurvey, setIncludeSurvey] = React.useState(true);
  const [includePermit, setIncludePermit] = React.useState(true);
  const [includeMaterials, setIncludeMaterials] = React.useState(true);
  const [includeShipping, setIncludeShipping] = React.useState(true);
  const [includePOC, setIncludePOC] = React.useState(true);

  // Selection State
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(
      collection(firestore, 'workItems'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, isUserLoading, user]);

  const { data: rawTasks, isLoading } = useCollection(tasksQuery);

  React.useEffect(() => {
    if (timeFrame === "custom") return;
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (timeFrame) {
      case 'daily': start = startOfDay(now); end = endOfDay(now); break;
      case 'weekly': start = startOfWeek(now); end = endOfWeek(now); break;
      case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
      case 'yearly': start = startOfYear(now); end = endOfYear(now); break;
      default: setFromDate(""); setDateTo(""); return;
    }

    if (start && end) {
      setFromDate(format(start, 'yyyy-MM-dd'));
      setDateTo(format(end, 'yyyy-MM-dd'));
    }
  }, [timeFrame]);

  const filteredTasks = React.useMemo(() => {
    if (!rawTasks) return [];
    let filtered = rawTasks.filter(task => {
      if (typeFilter !== "all" && task.workItemType !== typeFilter) return false;
      if (statusFilter !== "all" && task.overallWorkStatus !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (sourceFilter !== "all" && task.source !== sourceFilter) return false;
      
      const taskDateStr = task.dateInitiated || task.createdAt;
      if (fromDate && taskDateStr) {
        const taskDate = new Date(taskDateStr);
        const start = startOfDay(new Date(fromDate));
        const end = toDate ? endOfDay(new Date(toDate)) : endOfDay(new Date(fromDate));
        if (!isWithinInterval(taskDate, { start, end })) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const isACompleted = a.overallWorkStatus === 'Completed';
      const isBCompleted = b.overallWorkStatus === 'Completed';
      if (isACompleted && !isBCompleted) return 1;
      if (!isACompleted && isBCompleted) return -1;
      return 0;
    });
  }, [rawTasks, typeFilter, statusFilter, priorityFilter, sourceFilter, fromDate, toDate]);

  const reportTasks = React.useMemo(() => {
    if (selectedIds.size === 0) return filteredTasks;
    return filteredTasks.filter(t => selectedIds.has(t.id));
  }, [filteredTasks, selectedIds]);

  const stats = React.useMemo(() => {
    if (!reportTasks.length) return null;
    const total = reportTasks.length;
    const completed = reportTasks.filter(t => t.overallWorkStatus === 'Completed').length;
    
    const statusCounts = reportTasks.reduce((acc: any, t) => {
      const s = t.overallWorkStatus || 'Pending';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      completed,
      active: total - completed,
      successRate: Math.round((completed / total) * 100),
      statusData: Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
    };
  }, [reportTasks]);

  const handlePrint = () => {
    const printRoot = document.getElementById('print-root');
    const contentNode = reportRef.current;
    if (printRoot && contentNode) {
      printRoot.innerHTML = contentNode.innerHTML;
      const onAfterPrint = () => {
        printRoot.innerHTML = '';
        window.removeEventListener('afterprint', onAfterPrint);
      };
      window.addEventListener('afterprint', onAfterPrint);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  const handleExportExcel = () => {
    if (!reportTasks.length) return;
    const headers = ["#", "Address", "Title", "Category", "Status", "Priority", "Source"];
    if (includePOC) headers.push("POCs");
    if (includeSurvey) headers.push("Survey Handler", "Survey Status");
    if (includePermit) headers.push("Permit Handler", "Permit Status");
    if (includeMaterials) headers.push("Materials List");
    if (includeShipping) headers.push("Shipping Status");
    headers.push("Date Created", "Date Initiated", "Date Completed");

    const rows = reportTasks.map((t, idx) => {
      const row = [
        idx + 1,
        `"${t.siteAddressStreet || ''}"`,
        `"${t.title || ''}"`,
        t.workItemType || '',
        t.overallWorkStatus || '',
        t.priority || '',
        t.source || ''
      ];
      if (includePOC) row.push(`"${t.pocName || ''}"`);
      if (includeSurvey) row.push(`"${t.surveyHandler || ''}"`, `"${t.surveyStatus || ''}"`);
      if (includePermit) row.push(`"${t.permitHandler || ''}"`, `"${t.permitStatus || ''}"`);
      if (includeMaterials) {
        const matString = t.materialsRequired && t.materialsList 
          ? t.materialsList.map((m: any) => `${m.name} (x${m.quantity})`).join('; ')
          : 'None';
        row.push(`"${matString}"`);
      }
      if (includeShipping) row.push(t.shipmentRequired ? t.shipmentStatus || 'Pending' : 'N/A');
      row.push(
        t.createdAt ? format(new Date(t.createdAt), "yyyy-MM-dd") : '—',
        t.dateInitiated || '—',
        t.dateCompleted || '—'
      );
      return row;
    });

    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleReset = () => {
    setTimeFrame("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSourceFilter("all");
    setFromDate("");
    setDateTo("");
    setSelectedIds(new Set());
    setIncludeSurvey(true);
    setIncludePermit(true);
    setIncludeMaterials(true);
    setIncludeShipping(true);
    setIncludePOC(true);
    setIncludeStats(false);
    setIncludeCharts(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-bold border-slate-950 rounded-none h-10 px-6 uppercase text-[10px] tracking-widest">
          <FileText className="h-4 w-4 mr-2" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[1600px] w-[98vw] max-h-[95vh] overflow-y-auto rounded-none border-none p-0 bg-white">
        <DialogHeader className="p-6 border-b border-slate-200 sticky top-0 bg-white z-50 flex flex-row items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-950 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">Report Generator</DialogTitle>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="ghost" size="sm" onClick={handleReset} className="font-bold rounded-none h-10 px-4 uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-950">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="font-bold rounded-none h-10 px-6 uppercase text-[10px] tracking-widest border-slate-950 text-slate-950 hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel Export
            </Button>
            <Button variant="default" size="sm" onClick={handlePrint} className="font-bold rounded-none h-10 px-6 uppercase text-[10px] tracking-widest bg-slate-950 text-white shadow-none">
              <Printer className="h-4 w-4 mr-2" /> PDF Export
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          <div className="lg:col-span-4 border-r border-slate-100 p-8 space-y-10 print:hidden bg-slate-50/50">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Intelligent Filters</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Timeline</Label>
                  <Select value={timeFrame} onValueChange={setTimeFrame}>
                    <SelectTrigger className="h-10 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">Full Workspace History</SelectItem>
                      {['daily', 'weekly', 'monthly', 'yearly'].map(t => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">From</Label>
                  <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setTimeFrame("custom"); }} className="h-10 rounded-none border-slate-200 font-bold text-[10px] bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">To</Label>
                  <Input type="date" value={toDate} onChange={(e) => { setDateTo(e.target.value); setTimeFrame("custom"); }} className="h-10 rounded-none border-slate-200 font-bold text-[10px] bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Category</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-10 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Job">Jobs Only</SelectItem>
                      <SelectItem value="Project">Projects Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">State</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">All States</SelectItem>
                      {['Pending', 'In Progress', 'On Hold', 'Completed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Composition</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="stats-t" checked={includeStats} onCheckedChange={(v) => setIncludeStats(!!v)} className="rounded-none" />
                  <Label htmlFor="stats-t" className="text-[10px] font-bold uppercase cursor-pointer">Summary Intelligence</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="charts-t" checked={includeCharts} onCheckedChange={(v) => setIncludeCharts(!!v)} className="rounded-none" />
                  <Label htmlFor="charts-t" className="text-[10px] font-bold uppercase cursor-pointer">Visual Distribution</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="log-t" checked={includeLog} onCheckedChange={(v) => setIncludeLog(!!v)} className="rounded-none" />
                  <Label htmlFor="log-t" className="text-[10px] font-bold uppercase cursor-pointer">Operational Audit Log</Label>
                </div>
                
                {includeLog && (
                  <div className="pl-8 space-y-3 pt-2 border-l border-slate-200 ml-2 animate-in slide-in-from-top-1">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Select Log Columns</p>
                    <div className="flex items-center space-x-3">
                      <Checkbox id="col-poc" checked={includePOC} onCheckedChange={(v) => setIncludePOC(!!v)} className="rounded-none h-3 w-3" />
                      <Label htmlFor="col-poc" className="text-[9px] font-bold uppercase cursor-pointer text-slate-600">POCs</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox id="col-survey" checked={includeSurvey} onCheckedChange={(v) => setIncludeSurvey(!!v)} className="rounded-none h-3 w-3" />
                      <Label htmlFor="col-survey" className="text-[9px] font-bold uppercase cursor-pointer text-slate-600">Survey Phase</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox id="col-permit" checked={includePermit} onCheckedChange={(v) => setIncludePermit(!!v)} className="rounded-none h-3 w-3" />
                      <Label htmlFor="col-permit" className="text-[9px] font-bold uppercase cursor-pointer text-slate-600">Permit Status</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox id="col-materials" checked={includeMaterials} onCheckedChange={(v) => setIncludeMaterials(!!v)} className="rounded-none h-3 w-3" />
                      <Label htmlFor="col-materials" className="text-[9px] font-bold uppercase cursor-pointer text-slate-600">Materials & Items</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox id="col-shipping" checked={includeShipping} onCheckedChange={(v) => setIncludeShipping(!!v)} className="rounded-none h-3 w-3" />
                      <Label htmlFor="col-shipping" className="text-[9px] font-bold uppercase cursor-pointer text-slate-600">Shipping Status</Label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-primary" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Selection Matrix</h3>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{selectedIds.size || 'All'} Items</span>
              </div>
              <div className="border border-slate-200 rounded-none bg-white max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-[9px]">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr className="font-bold text-slate-950 uppercase">
                      <th className="px-4 py-3 w-10">
                        <Checkbox checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0} onCheckedChange={toggleSelectAll} className="rounded-none" />
                      </th>
                      <th className="px-4 py-3">Address - Title</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTasks.map(t => (
                      <tr key={t.id} className={cn("hover:bg-slate-50 cursor-pointer transition-colors", selectedIds.has(t.id) && "bg-primary/5")}>
                        <td className="px-4 py-3">
                          <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelectOne(t.id)} className="rounded-none" />
                        </td>
                        <td className="px-4 py-3 font-bold" onClick={() => toggleSelectOne(t.id)}>
                          <div className="flex flex-col">
                            <span>{t.siteAddressStreet}</span>
                            <span className="text-[8px] text-slate-400 uppercase">{t.title}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 p-8 md:p-12 overflow-y-auto bg-white" ref={reportRef}>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Compiling Intelligence...</p>
              </div>
            ) : !reportTasks.length ? (
              <div className="text-center py-40 border border-dashed border-slate-200 bg-slate-50">
                <p className="text-slate-400 uppercase font-bold text-[10px] tracking-widest">No matching records for scope.</p>
              </div>
            ) : (
              <div className="space-y-16">
                <div className="flex flex-col gap-2 border-l-4 border-slate-950 pl-6">
                  <h2 className="text-3xl font-bold text-slate-950 uppercase tracking-tight">Report</h2>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Period: {fromDate ? format(new Date(fromDate), "PPP") : "Historical"} — {toDate ? format(new Date(toDate), "PPP") : "Present"}</span>
                    <span>•</span>
                    <span>Dataset: {selectedIds.size > 0 ? `${selectedIds.size} Selected` : `Full Filter Result (${reportTasks.length})`}</span>
                  </div>
                </div>

                {includeStats && stats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-slate-50 p-8 border border-slate-200 space-y-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Work</p>
                      <p className="text-5xl font-bold text-slate-950">{stats.total}</p>
                    </div>
                    <div className="bg-slate-50 p-8 border border-slate-200 space-y-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Closure Index</p>
                      <p className="text-5xl font-bold text-slate-950">{stats.successRate}%</p>
                    </div>
                    <div className="bg-slate-50 p-8 border border-slate-200 space-y-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Pipeline</p>
                      <p className="text-5xl font-bold text-slate-950">{stats.active}</p>
                    </div>
                  </div>
                )}

                {includeCharts && stats && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 print:block">
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Lifecycle Distribution</h3>
                      <div className="h-[300px] w-full bg-slate-50 p-6 border border-slate-100">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.statusData}>
                            <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: "bold", fill: "#000" }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '10px', fontWeight: 'bold', border: 'none', backgroundColor: '#000', color: '#fff' }} />
                            <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                              {stats.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#000' : '#e2e8f0'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {includeLog && (
                  <div className="space-y-8 pt-12 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950">Detailed Operational Audit Log</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reportTasks.length} Logged Units</span>
                    </div>
                    <div className="border border-slate-950 bg-white overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[10px] min-w-[800px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-950 font-bold uppercase">
                            <th className="px-4 py-4 border-r border-slate-200 w-12 text-center">#</th>
                            <th className="px-4 py-4 border-r border-slate-200">Address - Title</th>
                            {includePOC && <th className="px-4 py-4 border-r border-slate-200">POCs</th>}
                            <th className="px-4 py-4 border-r border-slate-200">Status</th>
                            {includeSurvey && <th className="px-4 py-4 border-r border-slate-200">Survey Phase</th>}
                            {includePermit && <th className="px-4 py-4 border-r border-slate-200">Permit Status</th>}
                            {includeMaterials && <th className="px-4 py-4 border-r border-slate-200">Materials & Items</th>}
                            <th className="px-4 py-4">Operational Timeline</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reportTasks.map((task, idx) => (
                            <tr key={task.id} className="font-medium text-slate-900">
                              <td className="px-4 py-4 border-r border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-4 border-r border-slate-200 font-bold">
                                <div className="flex flex-col">
                                  <span>{task.siteAddressStreet}</span>
                                  <span className="text-[8px] text-slate-400 uppercase">{task.title}</span>
                                </div>
                              </td>
                              {includePOC && (
                                <td className="px-4 py-4 border-r border-slate-200 font-bold">
                                  {task.pocName || '—'}
                                </td>
                              )}
                              <td className="px-4 py-4 border-r border-slate-200 uppercase font-bold">{task.overallWorkStatus}</td>
                              {includeSurvey && (
                                <td className="px-4 py-4 border-r border-slate-200">
                                  {task.surveyRequired ? (
                                    <div className="flex flex-col">
                                      <span>{task.surveyStatus}</span>
                                      <span className="text-[8px] text-primary uppercase font-bold">By: {task.surveyHandler}</span>
                                    </div>
                                  ) : '—'}
                                </td>
                              )}
                              {includePermit && (
                                <td className="px-4 py-4 border-r border-slate-200">
                                  {task.permitRequired ? (
                                    <div className="flex flex-col">
                                      <span>{task.permitStatus}</span>
                                      <span className="text-[8px] text-primary uppercase font-bold">By: {task.permitHandler}</span>
                                    </div>
                                  ) : '—'}
                                </td>
                              )}
                              {includeMaterials && (
                                <td className="px-4 py-4 border-r border-slate-200 uppercase font-bold text-slate-600">
                                  {task.materialsRequired && task.materialsList?.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {task.materialsList.map((m: any, mIdx: number) => (
                                        <span key={mIdx} className="text-[8px] border-b border-slate-50 last:border-0 pb-0.5">
                                          {m.name} (x{m.quantity})
                                        </span>
                                      ))}
                                    </div>
                                  ) : '—'}
                                </td>
                              )}
                              <td className="px-4 py-4 font-bold text-slate-950">
                                <div className="flex flex-col gap-1.5 text-[8px]">
                                  <span>Created: {task.createdAt ? format(new Date(task.createdAt), "yyyy-MM-dd") : '—'}</span>
                                  <span>Initiated: {task.dateInitiated || '—'}</span>
                                  <span>Completed: {task.dateCompleted || '—'}</span>
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
            )}
          