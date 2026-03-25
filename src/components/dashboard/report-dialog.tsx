"use client"

import * as React from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  FileText, 
  Printer, 
  Filter,
  Settings2,
  RotateCcw,
  FileSpreadsheet,
  Loader2
} from "lucide-react"
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
} from "date-fns"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Cell
} from "recharts"
import { cn } from "@/lib/utils"

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8']

export function ReportDialog() {
  const [open, setOpen] = React.useState(false)
  const reportRef = React.useRef<HTMLDivElement>(null)
  const firestore = useFirestore()
  const { user, isUserLoading } = useUser()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => { setMounted(true); }, [])
  
  const [basis, setBasis] = React.useState<"createdAt" | "dateInitiated">("createdAt")
  const [timeFrame, setTimeFrame] = React.useState("all")
  const [fromDate, setFromDate] = React.useState<string>("")
  const [toDate, setDateTo] = React.useState<string>("")
  const [typeFilter, setTypeFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [priorityFilter, setPriorityFilter] = React.useState("all")
  const [sourceFilter, setSourceFilter] = React.useState("all")
  
  const [includeLog, setIncludeLog] = React.useState(true)
  const [includeStats, setIncludeStats] = React.useState(false)
  const [includeCharts, setIncludeCharts] = React.useState(false)

  const [includeSurvey, setIncludeSurvey] = React.useState(true)
  const [includePermit, setIncludePermit] = React.useState(true)
  const [includeMaterials, setIncludeMaterials] = React.useState(true)
  const [includeShipping, setIncludeShipping] = React.useState(true)
  const [includePOC, setIncludePOC] = React.useState(true)

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(
      collection(firestore, 'workItems'), 
      where('userId', '==', user.uid)
    );
  }, [firestore, isUserLoading, user])

  const { data: rawTasks, isLoading } = useCollection(tasksQuery)

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
  }, [timeFrame])

  const filteredTasks = React.useMemo(() => {
    if (!rawTasks) return [];
    let filtered = rawTasks.filter(task => {
      if (typeFilter !== "all" && task.workItemType !== typeFilter) return false;
      if (statusFilter !== "all" && task.overallWorkStatus !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (sourceFilter !== "all" && task.source !== sourceFilter) return false;
      
      const taskDateStr = task[basis];
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
  }, [rawTasks, typeFilter, statusFilter, priorityFilter, sourceFilter, fromDate, toDate, basis])

  const reportTasks = React.useMemo(() => {
    if (selectedIds.size === 0) return filteredTasks;
    return filteredTasks.filter(t => selectedIds.has(t.id));
  }, [filteredTasks, selectedIds])

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
  }, [reportTasks])

  const handlePrint = () => {
    const printRoot = document.getElementById('print-root');
    const contentNode = reportRef.current;
    if (printRoot && contentNode) {
      printRoot.innerHTML = '';
      const clone = contentNode.cloneNode(true) as HTMLElement;
      printRoot.appendChild(clone);
      setTimeout(() => {
        window.print();
        printRoot.innerHTML = '';
      }, 600);
    }
  }

  const handleExportExcel = () => {
    if (!reportTasks.length) return;
    const headers = ["#", "Address", "Title", "Category", "Status", "Priority", "Source"];
    if (includePOC) headers.push("Site POCs");
    if (includeSurvey) headers.push("Survey Handler", "Survey Status");
    if (includePermit) headers.push("Permit Handler", "Permit Status");
    if (includeMaterials) headers.push("Materials List");
    if (includeShipping) headers.push("Shipping Status");
    headers.push("Created", "Initiated", "Completed");

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
    link.setAttribute("download", `Audit_Report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  const handleReset = () => {
    setBasis("createdAt");
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
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-bold border-slate-950 rounded-none h-10 px-6 uppercase text-[10px] tracking-widest">
          <FileText className="h-4 w-4 mr-2" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl w-[98vw] h-[95vh] rounded-none border-none p-0 bg-white overflow-hidden flex flex-col">
        <DialogHeader className="p-4 sm:p-6 border-b border-slate-200 bg-white z-50 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-950 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-base sm:text-xl font-bold uppercase tracking-tight">Report Generator</DialogTitle>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            <Button variant="ghost" size="sm" onClick={handleReset} className="font-bold rounded-none h-10 px-3 uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-950 shrink-0">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="font-bold rounded-none h-10 px-3 uppercase text-[10px] tracking-widest border-slate-950 text-slate-950 hover:bg-slate-50 shrink-0">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="default" size="sm" onClick={handlePrint} className="font-bold rounded-none h-10 px-3 uppercase text-[10px] tracking-widest bg-slate-950 text-white shadow-none shrink-0">
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          {/* Configuration Panel */}
          <div className="w-full lg:w-[350px] border-b lg:border-b-0 lg:border-r border-slate-100 p-4 sm:p-6 space-y-6 print:hidden bg-slate-50/50 shrink-0 lg:overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Intelligence Filters</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Foundation</Label>
                  <Select value={basis} onValueChange={(v: any) => setBasis(v)}>
                    <SelectTrigger className="h-9 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="createdAt">Date Created</SelectItem>
                      <SelectItem value="dateInitiated">Date Initiated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Interval</Label>
                  <Select value={timeFrame} onValueChange={setTimeFrame}>
                    <SelectTrigger className="h-9 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">Full History</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {timeFrame === "custom" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Start</Label>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-none border-slate-200 font-bold text-[10px] bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">End</Label>
                      <Input type="date" value={toDate} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-none border-slate-200 font-bold text-[10px] bg-white" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Report Composition</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="stats-t" checked={includeStats} onCheckedChange={(v) => setIncludeStats(!!v)} className="rounded-none" />
                  <Label htmlFor="stats-t" className="text-[10px] font-bold uppercase cursor-pointer">Metrics</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="charts-t" checked={includeCharts} onCheckedChange={(v) => setIncludeCharts(!!v)} className="rounded-none" />
                  <Label htmlFor="charts-t" className="text-[10px] font-bold uppercase cursor-pointer">Distribution</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="poc-t" checked={includePOC} onCheckedChange={(v) => setIncludePOC(!!v)} className="rounded-none" />
                  <Label htmlFor="poc-t" className="text-[10px] font-bold uppercase cursor-pointer">Site POCs</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="survey-t" checked={includeSurvey} onCheckedChange={(v) => setIncludeSurvey(!!v)} className="rounded-none" />
                  <Label htmlFor="survey-t" className="text-[10px] font-bold uppercase cursor-pointer">Surveys</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="permit-t" checked={includePermit} onCheckedChange={(v) => setIncludePermit(!!v)} className="rounded-none" />
                  <Label htmlFor="permit-t" className="text-[10px] font-bold uppercase cursor-pointer">Permits</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="mat-t" checked={includeMaterials} onCheckedChange={(v) => setIncludeMaterials(!!v)} className="rounded-none" />
                  <Label htmlFor="mat-t" className="text-[10px] font-bold uppercase cursor-pointer">Materials</Label>
                </div>
                <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                  <Checkbox id="ship-t" checked={includeShipping} onCheckedChange={(v) => setIncludeShipping(!!v)} className="rounded-none" />
                  <Label htmlFor="ship-t" className="text-[10px] font-bold uppercase cursor-pointer">Shipping</Label>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Unit Selection</h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{selectedIds.size || 'All'} Selected</span>
              </div>
              <div className="border border-slate-200 rounded-none bg-white max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-[9px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                    <tr className="font-bold text-slate-950 uppercase">
                      <th className="px-3 py-2.5 w-8">
                        <Checkbox checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0} onCheckedChange={toggleSelectAll} className="rounded-none" />
                      </th>
                      <th className="px-3 py-2.5">Ref Address - Title</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTasks.map(t => (
                      <tr key={t.id} className={cn("hover:bg-slate-50 cursor-pointer", selectedIds.has(t.id) && "bg-slate-50")}>
                        <td className="px-3 py-2.5">
                          <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelectOne(t.id)} className="rounded-none" />
                        </td>
                        <td className="px-3 py-2.5 font-bold" onClick={() => toggleSelectOne(t.id)}>
                          <div className="flex flex-col">
                            <span>{t.siteAddressStreet}</span>
                            <span className="text-[8px] text-slate-400 uppercase mt-0.5">{t.title}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Report Preview */}
          <div className="flex-1 bg-white overflow-y-auto lg:overflow-y-auto min-h-0">
            <div className="p-4 sm:p-8" ref={reportRef}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Compiling Audit Intelligence...</p>
                </div>
              ) : !reportTasks.length ? (
                <div className="text-center py-40 border border-dashed border-slate-200 bg-slate-50">
                  <p className="text-slate-400 uppercase font-bold text-[10px] tracking-widest">No matching records found for this scope.</p>
                </div>
              ) : (
                <div className="space-y-12">
                  <div className="flex flex-col gap-2 border-l-4 border-slate-950 pl-6">
                    <h2 className="text-2xl font-bold text-slate-950 uppercase tracking-tight">Audit Report</h2>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Basis: {basis === 'createdAt' ? 'Date Created' : 'Date Initiated'}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Window: {fromDate ? format(new Date(fromDate), "PPP") : "Full History"} — {toDate ? format(new Date(toDate), "PPP") : (mounted ? format(new Date(), "PPP") : "")}</span>
                    </div>
                  </div>

                  {includeStats && stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="bg-slate-50 p-8 border border-slate-200 space-y-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Audited Units</p>
                        <p className="text-4xl font-bold text-slate-950">{stats.total}</p>
                      </div>
                      <div className="bg-slate-50 p-8 border border-slate-200 space-y-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Success Index</p>
                        <p className="text-4xl font-bold text-slate-950">{stats.successRate}%</p>
                      </div>
                      <div className="bg-slate-50 p-8 border border-slate-200 space-y-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active State</p>
                        <p className="text-4xl font-bold text-slate-950">{stats.active}</p>
                      </div>
                    </div>
                  )}

                  {includeCharts && stats && (
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Lifecycle Distribution</h3>
                      <div className="h-[300px] w-full bg-slate-50 p-6 border border-slate-100">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.statusData}>
                            <XAxis dataKey="name" tick={{ fontSize: 9, fontBold: "bold", fill: "#000" }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '10px', fontBold: "bold", border: 'none', backgroundColor: '#000', color: '#fff' }} />
                            <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                              {stats.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#000' : '#e2e8f0'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {includeLog && (
                    <div className="space-y-8 pt-12 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950">Detailed Operational Audit Log</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reportTasks.length} Tracked Units</span>
                      </div>
                      <div className="border border-slate-200 bg-white overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left text-[9px] border-collapse min-w-[1600px] print:min-w-[1400px]">
                          <thead>
                            <tr className="bg-slate-50 border-b font-bold uppercase tracking-wider">
                              <th className="px-4 py-4 border-r w-12 text-center">#</th>
                              <th className="px-4 py-4 border-r min-w-[300px]">Site Address & Title</th>
                              {includePOC && <th className="px-4 py-4 border-r min-w-[200px]">Site POCs</th>}
                              <th className="px-4 py-4 border-r w-32">Category</th>
                              <th className="px-4 py-4 border-r w-32">State</th>
                              {includeSurvey && <th className="px-4 py-4 border-r min-w-[150px]">Survey Phase</th>}
                              {includePermit && <th className="px-4 py-4 border-r min-w-[150px]">Permit Status</th>}
                              {includeMaterials && <th className="px-4 py-4 border-r min-w-[180px]">Material Inv.</th>}
                              {includeShipping && <th className="px-4 py-4 border-r w-32">Logistics</th>}
                              <th className="px-4 py-4 border-r w-28">Created</th>
                              <th className="px-4 py-4 border-r w-28">Initiated</th>
                              <th className="px-4 py-4 w-28">Completed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportTasks.map((task, idx) => (
                              <tr key={task.id} className="font-medium text-slate-900 border-b last:border-0">
                                <td className="px-4 py-4 border-r text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="px-4 py-4 border-r font-bold">
                                  <div className="flex flex-col">
                                    <span>{task.siteAddressStreet}</span>
                                    <span className="text-[7px] text-slate-400 uppercase mt-1 leading-none">{task.title}</span>
                                  </div>
                                </td>
                                {includePOC && <td className="px-4 py-4 border-r whitespace-pre-wrap">{task.pocName || '—'}</td>}
                                <td className="px-4 py-4 border-r uppercase font-bold">{task.workItemType}</td>
                                <td className="px-4 py-4 border-r uppercase font-bold">{task.overallWorkStatus}</td>
                                {includeSurvey && (
                                  <td className="px-4 py-4 border-r">
                                    <div className="flex flex-col">
                                      <span className="font-bold uppercase">{task.surveyRequired ? task.surveyStatus : 'N/A'}</span>
                                      {task.surveyRequired && <span className="text-[7px] text-primary font-bold uppercase mt-0.5">{task.surveyHandler}</span>}
                                    </div>
                                  </td>
                                )}
                                {includePermit && (
                                  <td className="px-4 py-4 border-r">
                                    <div className="flex flex-col">
                                      <span className="font-bold uppercase">{task.permitRequired ? task.permitStatus : 'N/A'}</span>
                                      {task.permitRequired && <span className="text-[7px] text-primary font-bold uppercase mt-0.5">{task.permitHandler}</span>}
                                    </div>
                                  </td>
                                )}
                                {includeMaterials && (
                                  <td className="px-4 py-4 border-r">
                                    <div className="flex flex-col gap-0.5">
                                      {task.materialsRequired && task.materialsList?.length > 0 ? (
                                        task.materialsList.map((m: any, i: number) => (
                                          <span key={i} className="text-[7px] font-bold uppercase leading-tight bg-slate-50 px-1 py-0.5 border border-slate-100 truncate">{m.name} (x{m.quantity})</span>
                                        ))
                                      ) : 'None'}
                                    </div>
                                  </td>
                                )}
                                {includeShipping && <td className="px-4 py-4 border-r uppercase font-bold">{task.shipmentRequired ? task.shipmentStatus : 'N/A'}</td>}
                                <td className="px-4 py-4 border-r font-bold">{task.createdAt ? format(new Date(task.createdAt), "yyyy-MM-dd") : '—'}</td>
                                <td className="px-4 py-4 border-r font-bold">{task.dateInitiated || '—'}</td>
                                <td className="px-4 py-4 font-bold">{task.dateCompleted || '—'}</td>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
