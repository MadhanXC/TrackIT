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
  Filter,
  Settings2,
  RotateCcw,
  FileSpreadsheet,
  Loader2,
  Printer,
  Calendar as CalendarIcon,
  CheckSquare
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
  endOfYear,
  parseISO
} from "date-fns"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { generateAuditPdf } from "@/lib/pdf-service"

export function ReportDialog() {
  const [open, setOpen] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
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
      
      const rawValue = task[basis];
      if (!rawValue && timeFrame !== "all") return false;
      
      if (timeFrame !== "all" && fromDate) {
        try {
          const taskDate = typeof rawValue === 'string' && rawValue.includes('T') 
            ? parseISO(rawValue) 
            : new Date(rawValue);
          
          if (isNaN(taskDate.getTime())) return false;

          const start = startOfDay(new Date(fromDate));
          const end = toDate ? endOfDay(new Date(toDate)) : endOfDay(new Date(fromDate));
          
          if (!isWithinInterval(taskDate, { start, end })) return false;
        } catch (e) {
          return false;
        }
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
  }, [rawTasks, typeFilter, statusFilter, priorityFilter, sourceFilter, fromDate, toDate, basis, timeFrame])

  const reportTasks = React.useMemo(() => {
    if (selectedIds.size === 0) return filteredTasks;
    return filteredTasks.filter(t => selectedIds.has(t.id));
  }, [filteredTasks, selectedIds])

  const stats = React.useMemo(() => {
    if (!reportTasks.length) return null;
    const total = reportTasks.length;
    const completed = reportTasks.filter(t => t.overallWorkStatus === 'Completed').length;
    
    const surveyItems = reportTasks.filter(t => t.surveyRequired);
    const surveys = {
      total: surveyItems.length,
      pending: surveyItems.filter(t => t.surveyStatus !== 'Completed').length,
      completed: surveyItems.filter(t => t.surveyStatus === 'Completed').length,
    };

    const permitItems = reportTasks.filter(t => t.permitRequired);
    const permits = {
      total: permitItems.length,
      pending: permitItems.filter(t => t.permitStatus !== 'Approved').length,
      approved: permitItems.filter(t => t.permitStatus === 'Approved').length,
    };

    const shipmentItems = reportTasks.filter(t => t.shipmentRequired);
    const shipments = {
      total: shipmentItems.length,
      pending: shipmentItems.filter(t => t.shipmentStatus !== 'Delivered').length,
      delivered: shipmentItems.filter(t => t.shipmentStatus === 'Delivered').length,
    };

    return {
      total,
      completed,
      active: total - completed,
      successRate: Math.round((completed / total) * 100),
      surveys,
      permits,
      shipments
    };
  }, [reportTasks])

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExportPdf = async () => {
    if (!reportTasks.length || !stats) return;
    setIsExporting(true);
    try {
      const blob = await generateAuditPdf(reportTasks, {
        basis,
        timeFrame,
        fromDate,
        toDate,
        includePOC,
        includeSurvey,
        includePermit,
        includeMaterials,
        includeShipping,
        summaryStats: stats
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Audit_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF Export Error:", e);
    } finally {
      setIsExporting(false);
    }
  }

  const handleExportExcel = () => {
    if (!reportTasks.length || !stats) return;

    const headerRows = [
      ["PLS AUDIT REPORT"],
      ["Report Generated", format(new Date(), "PPP p")],
      ["Period", timeFrame === 'all' ? 'Full History' : `${fromDate} to ${toDate || 'Now'}`],
      [],
      ["#", "Address", "Title", "Category", "Status", "Priority", "Source"]
    ];

    const currentHeaders = headerRows[headerRows.length - 1];
    if (includePOC) currentHeaders.push("Site POCs");
    if (includeSurvey) currentHeaders.push("Survey Handler", "Survey Status");
    if (includePermit) currentHeaders.push("Permit Handler", "Permit Status");
    if (includeMaterials) currentHeaders.push("Materials List");
    if (includeShipping) currentHeaders.push("Shipment Status");
    currentHeaders.push("Created", "Initiated", "Completed");

    const dataRows = reportTasks.map((t, idx) => {
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
        t.dateCompleted || 'Not Completed'
      );
      return row;
    });

    const summaryRows = [
      [],
      ["SUMMARY"],
      ["Total Items", stats.total],
      ["Completion Rate", `${stats.successRate}%`],
      ["Pending Items", stats.active],
      ["Survey Status", `Total Items: ${stats.surveys.total} (Pending: ${stats.surveys.pending}, Completed: ${stats.surveys.completed})`],
      ["Permit Status", `Total Items: ${stats.permits.total} (Pending: ${stats.permits.pending}, Approved: ${stats.permits.approved})`],
      ["Shipment Status", `Total Items: ${stats.shipments.total} (Pending: ${stats.shipments.pending}, Delivered: ${stats.shipments.delivered})`]
    ];

    const csvContent = [...headerRows, ...dataRows, ...summaryRows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Audit_Report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-bold border-slate-950 rounded-none h-10 px-6 uppercase text-[10px] tracking-widest">
          <FileText className="h-4 w-4 mr-2" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl w-[98vw] h-[95vh] rounded-none border-none p-0 bg-white overflow-hidden flex flex-col">
        <DialogHeader className="p-4 sm:p-6 border-b border-slate-200 bg-white z-50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-950 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-base sm:text-xl font-bold uppercase tracking-tight">Report Generator</DialogTitle>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            <Button variant="ghost" size="sm" onClick={() => { setBasis("createdAt"); setTimeFrame("all"); setSelectedIds(new Set()); }} className="font-bold rounded-none h-10 px-3 uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-950 shrink-0">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="font-bold rounded-none h-10 px-3 uppercase text-[10px] tracking-widest border-slate-950 text-slate-950 hover:bg-slate-50 shrink-0">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="default" size="sm" onClick={handleExportPdf} disabled={isExporting} className="font-bold rounded-none h-10 px-3 uppercase text-[10px] tracking-widest bg-slate-950 text-white shadow-none shrink-0 min-w-[100px]">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} {isExporting ? 'Generating...' : 'PDF'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-white flex flex-col lg:flex-row min-h-0">
          {/* Configuration Panel */}
          <div className="w-full lg:w-[350px] border-b lg:border-b-0 lg:border-r border-slate-100 p-4 sm:p-6 space-y-6 bg-slate-50/50 shrink-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Audit Controls</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Date Basis</Label>
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

                {timeFrame === 'custom' && (
                  <>
                    <div className="col-span-2 sm:col-span-1 space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">From</Label>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-none border-slate-200 bg-white text-[10px] font-bold" />
                    </div>
                    <div className="col-span-2 sm:col-span-1 space-y-1.5">
                      <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">To</Label>
                      <Input type="date" value={toDate} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-none border-slate-200 bg-white text-[10px] font-bold" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Data Inclusion</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {id:'poc-t', l:'Site POCs', s:includePOC, f:setIncludePOC}, 
                  {id:'survey-t', l:'Surveys', s:includeSurvey, f:setIncludeSurvey}, 
                  {id:'permit-t', l:'Permits', s:includePermit, f:setIncludePermit}, 
                  {id:'mat-t', l:'Materials', s:includeMaterials, f:setIncludeMaterials}, 
                  {id:'ship-t', l:'Shipments', s:includeShipping, f:setIncludeShipping}
                ].map(item => (
                  <div key={item.id} className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                    <Checkbox id={item.id} checked={item.s} onCheckedChange={(v) => item.f(!!v)} className="rounded-none border-slate-300" />
                    <Label htmlFor={item.id} className="text-[10px] font-bold uppercase cursor-pointer">{item.l}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200">
               <div className="p-4 bg-slate-950 text-white space-y-1">
                 <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-50">Auditing Selection</p>
                 <p className="text-xl font-bold">{selectedIds.size > 0 ? selectedIds.size : filteredTasks.length}</p>
                 <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">
                   {selectedIds.size > 0 ? "Targeted Selection" : "Full Scope Matches"}
                 </p>
               </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 bg-white relative overflow-y-auto scrollbar-hide">
            <div className="p-4 sm:p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Compiling Intelligence...</p>
                </div>
              ) : !filteredTasks.length ? (
                <div className="text-center py-40 border border-dashed border-slate-200 bg-slate-50">
                  <p className="text-slate-400 uppercase font-bold text-[10px] tracking-widest">No matching records.</p>
                </div>
              ) : (
                <div className="space-y-12">
                  <div className="flex flex-col gap-2 border-l-4 border-slate-950 pl-6">
                    <h2 className="text-2xl font-bold text-slate-950 uppercase tracking-tight">Audit Log Preview</h2>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Basis: {basis === 'createdAt' ? 'Date Created' : 'Date Initiated'}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Period: {fromDate ? format(new Date(fromDate), "PPP") : "Full History"}</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 bg-white overflow-x-auto scrollbar-default">
                    <table className="w-full text-left text-[9px] border-collapse min-w-[1800px]">
                      <thead>
                        <tr className="bg-slate-50 border-b font-bold uppercase tracking-wider">
                          <th className="px-4 py-4 border-r w-12 text-center">
                            <CheckSquare className="h-3 w-3 mx-auto text-slate-400" />
                          </th>
                          <th className="px-4 py-4 border-r w-12 text-center">#</th>
                          <th className="px-4 py-4 border-r min-w-[500px]">Site Address & Title</th>
                          {includePOC && <th className="px-4 py-4 border-r min-w-[200px]">Site POCs</th>}
                          <th className="px-4 py-4 border-r w-32">Category</th>
                          <th className="px-4 py-4 border-r w-32">State</th>
                          {includeSurvey && <th className="px-4 py-4 border-r min-w-[150px]">Survey Phase</th>}
                          {includePermit && <th className="px-4 py-4 border-r min-w-[150px]">Permit Status</th>}
                          {includeMaterials && <th className="px-4 py-4 border-r min-w-[180px]">Material Inventory</th>}
                          {includeShipping && <th className="px-4 py-4 border-r w-32">Shipments</th>}
                          <th className="px-4 py-4 border-r w-28">Created</th>
                          <th className="px-4 py-4 border-r w-28">Initiated</th>
                          <th className="px-4 py-4 w-28">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {filteredTasks.map((task, idx) => (
                          <tr 
                            key={task.id} 
                            className={cn(
                              "font-medium text-slate-900 border-b last:border-0 hover:bg-slate-50 transition-colors",
                              selectedIds.has(task.id) ? "bg-primary/5" : "bg-white"
                            )}
                          >
                            <td className="px-4 py-4 border-r text-center">
                              <Checkbox 
                                checked={selectedIds.has(task.id)} 
                                onCheckedChange={() => toggleSelection(task.id)} 
                                className="rounded-none"
                              />
                            </td>
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
                            {includeSurvey && <td className="px-4 py-4 border-r"><div className="flex flex-col"><span className="font-bold uppercase">{task.surveyRequired ? task.surveyStatus : 'N/A'}</span>{task.surveyRequired && <span className="text-[7px] text-primary font-bold uppercase mt-0.5">{task.surveyHandler}</span>}</div></td>}
                            {includePermit && <td className="px-4 py-4 border-r"><div className="flex flex-col"><span className="font-bold uppercase">{task.permitRequired ? task.permitStatus : 'N/A'}</span>{task.permitRequired && <span className="text-[7px] text-primary font-bold uppercase mt-0.5">{task.permitHandler}</span>}</div></td>}
                            {includeMaterials && <td className="px-4 py-4 border-r"><div className="flex flex-col gap-0.5">{task.materialsRequired && task.materialsList?.length > 0 ? task.materialsList.map((m: any, i: number) => <span key={i} className="text-[7px] font-bold uppercase leading-tight bg-slate-50 px-1 py-0.5 border border-slate-100 truncate">{m.name} (x{m.quantity})</span>) : 'None'}</div></td>}
                            {includeShipping && <td className="px-4 py-4 border-r uppercase font-bold">{task.shipmentRequired ? task.shipmentStatus : 'N/A'}</td>}
                            <td className="px-4 py-4 border-r font-bold">{task.createdAt ? format(new Date(task.createdAt), "yyyy-MM-dd") : '—'}</td>
                            <td className="px-4 py-4 border-r font-bold">{task.dateInitiated || '—'}</td>
                            <td className="px-4 py-4 font-bold">{task.dateCompleted || 'Not Completed'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {stats && (
                    <div className="pt-8 border-t border-slate-200">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950 mb-6">Summary</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                          {l:'Total Items', v:stats.total}, 
                          {l:'Completion Rate', v:`${stats.successRate}%`}, 
                          {l:'Pending Items', v:stats.active}, 
                          {l:'Survey Breakdown', v:`${stats.surveys.total} Total Items`, s:`Pending: ${stats.surveys.pending} / Completed: ${stats.surveys.completed}`}, 
                          {l:'Permit Status', v:`${stats.permits.total} Total Items`, s:`Pending: ${stats.permits.pending} / Approved: ${stats.permits.approved}`}, 
                          {l:'Shipment Status', v:`${stats.shipments.total} Total Items`, s:`Pending: ${stats.shipments.pending} / Delivered: ${stats.shipments.delivered}`}
                        ].map((m, i) => (
                          <div key={i} className="p-4 bg-slate-50/50 border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">{m.l}</p>
                            <p className="text-xl font-bold text-slate-950">{m.v}</p>
                            {m.s && <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{m.s}</p>}
                          </div>
                        ))}
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