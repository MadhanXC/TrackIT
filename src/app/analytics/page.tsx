
"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { 
  Printer, 
  FileText, 
  TrendingUp, 
  Loader2,
  Calendar as CalendarIcon,
  Layers,
  Filter,
  CheckCircle2,
  Settings2,
  RotateCcw,
  MousePointerClick
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
import { DateRange } from "react-day-picker"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

export default function AnalyticsPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const [includeSummary, setIncludeSummary] = React.useState(true);
  const [includeCharts, setIncludeCharts] = React.useState(true);
  const [includeTable, setIncludeTable] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  
  const [basis, setBasis] = React.useState<"createdAt" | "dateInitiated">("createdAt");
  const [timeFrame, setTimeFrame] = React.useState("all");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });
  
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Update date range based on timeframe
  React.useEffect(() => {
    if (timeFrame === "custom") return;
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (timeFrame) {
      case 'daily': start = startOfDay(now); end = endOfDay(now); break;
      case 'weekly': start = startOfWeek(now); end = endOfWeek(now); break;
      case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
      case 'yearly': start = startOfYear(now); end = endOfYear(now); break;
      default: setDateRange(undefined); return;
    }

    if (start && end) {
      setDateRange({ from: start, to: end });
    }
  }, [timeFrame]);

  // Work Items Query
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(
      collection(firestore, 'workItems'), 
      where('userId', '==', user.uid)
    );
  }, [firestore, isUserLoading, user]);

  const { data: rawTasks, isLoading } = useCollection(tasksQuery);

  const filteredTasks = React.useMemo(() => {
    if (!rawTasks) return [];
    
    let filtered = rawTasks.filter(task => {
      if (typeFilter !== "all" && task.workItemType !== typeFilter) return false;
      if (statusFilter !== "all" && task.overallWorkStatus !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (sourceFilter !== "all" && task.source !== sourceFilter) return false;
      
      const taskDateStr = task[basis];
      if (dateRange?.from && taskDateStr) {
        const taskDate = new Date(taskDateStr);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
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
  }, [rawTasks, typeFilter, statusFilter, priorityFilter, sourceFilter, dateRange, basis]);

  const reportTasks = React.useMemo(() => {
    if (selectedIds.size === 0) return filteredTasks;
    return filteredTasks.filter(t => selectedIds.has(t.id));
  }, [filteredTasks, selectedIds]);

  const stats = React.useMemo(() => {
    if (!reportTasks.length) return null;

    const statusCounts = reportTasks.reduce((acc: any, t) => {
      const status = t.overallWorkStatus || 'Pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const sourceCounts = reportTasks.reduce((acc: any, t) => {
      const s = t.source || 'Call';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    return {
      total: reportTasks.length,
      completed: reportTasks.filter(t => t.overallWorkStatus === 'Completed').length,
      active: reportTasks.filter(t => t.overallWorkStatus !== 'Completed').length,
      statusData: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      sourceData: Object.entries(sourceCounts).map(([name, value]) => ({ name, value })),
    };
  }, [reportTasks]);

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

  const handlePrint = () => {
    const printRoot = document.getElementById('print-root');
    const reportContent = document.getElementById('final-report-content');
    if (printRoot && reportContent) {
      printRoot.innerHTML = reportContent.innerHTML;
      setTimeout(() => {
        window.print();
        printRoot.innerHTML = '';
      }, 500);
    }
  };

  const COLORS = ['#4f46e5', '#94a3b8', '#1e293b', '#6366f1', '#cbd5e1'];

  return (
    <div className="flex min-h-screen bg-white w-full">
      <AppSidebar />
      <SidebarInset className="flex flex-col flex-1">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-slate-100 bg-white sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-sm md:text-lg font-bold text-slate-950 font-headline uppercase tracking-tight">Report Generator</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" onClick={handlePrint} className="font-bold rounded-none h-10 px-4 md:px-6 uppercase text-[10px] tracking-widest shadow-none">
              <Printer className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Export Final Report</span><span className="sm:hidden">Export</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <div className="mb-8 space-y-6 print:hidden">
            <div className="flex flex-col gap-6 bg-slate-50 p-4 md:p-6 border border-slate-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Intelligent Filters</h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setBasis("createdAt");
                      setTimeFrame("all");
                      setTypeFilter("all");
                      setStatusFilter("all");
                      setPriorityFilter("all");
                      setSourceFilter("all");
                      setDateRange(undefined);
                      setSelectedIds(new Set());
                    }}
                    className="h-6 text-[9px] font-bold uppercase text-slate-400 hover:text-primary tracking-widest"
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" /> Reset Configuration
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Date Basis</Label>
                    <Select value={basis} onValueChange={(v: any) => setBasis(v)}>
                      <SelectTrigger className="h-10 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="createdAt">Date Created</SelectItem>
                        <SelectItem value="dateInitiated">Date Initiated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Timeframe</Label>
                    <Select value={timeFrame} onValueChange={setTimeFrame}>
                      <SelectTrigger className="h-10 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white">
                        <SelectValue />
                      </SelectTrigger>
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

                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Timeline</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-bold text-[10px] uppercase h-10 rounded-none border-slate-200 bg-white", !dateRange && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</>
                            ) : format(dateRange.from, "LLL dd")
                          ) : <span>Full History</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-none border-slate-200 shadow-xl" align="start">
                        <Calendar mode="range" selected={dateRange} onSelect={(r) => { setDateRange(r); setTimeFrame("custom"); }} numberOfMonths={2} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Category</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-10 rounded-none border-slate-200 font-bold text-[10px] uppercase bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Job">Jobs Only</SelectItem>
                        <SelectItem value="Project">Projects Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Report Composition</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                    <Checkbox id="sum" checked={includeSummary} onCheckedChange={(v) => setIncludeSummary(!!v)} className="rounded-none" />
                    <Label htmlFor="sum" className="text-[10px] font-bold uppercase cursor-pointer">Summary Intelligence</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                    <Checkbox id="charts" checked={includeCharts} onCheckedChange={(v) => setIncludeCharts(!!v)} className="rounded-none" />
                    <Label htmlFor="charts" className="text-[10px] font-bold uppercase cursor-pointer">Distribution Charts</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-white p-3 border border-slate-100">
                    <Checkbox id="table" checked={includeTable} onCheckedChange={(v) => setIncludeTable(!!v)} className="rounded-none" />
                    <Label htmlFor="table" className="text-[10px] font-bold uppercase cursor-pointer">Operational Log</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-12 space-y-4 print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950">Selection Matrix</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {filteredTasks.length} Records — {selectedIds.size || 'All'} Selected
              </span>
            </div>
            
            <div className="border border-slate-200 rounded-none overflow-x-auto bg-white">
              <table className="w-full text-left text-[10px] min-w-[800px] border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="font-bold text-slate-950 uppercase tracking-wider">
                    <th className="px-6 py-5 w-16 border border-slate-200">
                      <Checkbox 
                        checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0} 
                        onCheckedChange={toggleSelectAll} 
                        className="rounded-none"
                      />
                    </th>
                    <th className="px-6 py-5 border border-slate-200">Address - Title</th>
                    <th className="px-6 py-5 border border-slate-200">Category</th>
                    <th className="px-6 py-5 text-center border border-slate-200">Lifecycle</th>
                    <th className="px-6 py-5 text-center border border-slate-200">Priority</th>
                    <th className="px-6 py-5 text-right border border-slate-200">Channel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => (
                    <tr 
                      key={task.id} 
                      className={cn(
                        "text-slate-900 font-medium hover:bg-slate-50 transition-colors",
                        selectedIds.has(task.id) && "bg-primary/5"
                      )}
                    >
                      <td className="px-6 py-4 border border-slate-200">
                        <Checkbox 
                          checked={selectedIds.has(task.id)} 
                          onCheckedChange={() => toggleSelectOne(task.id)} 
                          className="rounded-none"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold border border-slate-200">
                        <div className="flex flex-col">
                          <span className="text-slate-950">{task.siteAddressStreet}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{task.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 border border-slate-200">
                        <span className="px-2 py-1 bg-slate-100 font-bold uppercase text-[9px] tracking-tighter">{task.workItemType}</span>
                      </td>
                      <td className="px-6 py-4 text-center uppercase font-bold border border-slate-200">
                        <span className={cn(
                          "px-2 py-1",
                          task.overallWorkStatus === 'Completed' ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-600"
                        )}>
                          {task.overallWorkStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center border border-slate-200">
                        <span className={cn(
                          "px-2 py-1 font-bold uppercase text-[9px]",
                          task.priority === 'Urgent' ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right uppercase font-bold text-slate-500 border border-slate-200">{task.source}</td>
                    </tr>
                  ))}
                  {!filteredTasks.length && !isLoading && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest border border-slate-200">
                        No operational records matching configuration.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div id="final-report-content" className="space-y-12">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 print:hidden">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Compiling Intelligence...</p>
              </div>
            ) : !stats ? (
              <div className="text-center py-32 border border-dashed border-slate-200 bg-slate-50 print:hidden">
                <p className="text-slate-400 uppercase font-bold text-xs tracking-widest">No matching results for scope.</p>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex flex-col gap-2 border-l-4 border-primary pl-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-950 uppercase tracking-tight">Report</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Basis: {basis === 'createdAt' ? 'Date Created' : 'Date Initiated'}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Period: {dateRange?.from ? format(dateRange.from, "PPP") : "Full History"} — {dateRange?.to ? format(dateRange.to, "PPP") : (mounted ? format(new Date(), "PPP") : "")}</span>
                  </div>
                </div>

                {includeSummary && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    <Card className="rounded-none border-slate-200 shadow-none bg-slate-50/50">
                      <CardContent className="pt-8">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Total Work</p>
                        <p className="text-4xl md:text-5xl font-bold text-slate-950">{stats.total}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-none border-slate-200 shadow-none bg-slate-50/50">
                      <CardContent className="pt-8">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Completion Index</p>
                        <p className="text-4xl md:text-5xl font-bold text-slate-950">
                          {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-none border-slate-200 shadow-none bg-slate-50/50">
                      <CardContent className="pt-8">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Pipeline Engagement</p>
                        <p className="text-4xl md:text-5xl font-bold text-slate-950">{stats.active}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {includeCharts && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 print:block">
                    <Card className="rounded-none border-slate-200 shadow-none print:mb-12 print:border-none">
                      <CardHeader className="border-b border-slate-50">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest">Workflow State Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-8 h-[300px] md:h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.statusData}>
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: "#000", fontSize: 10, fontWeight: "bold" }} 
                            />
                            <YAxis hide />
                            <Tooltip 
                              contentStyle={{ backgroundColor: "#000", border: "none", color: "white", fontSize: "10px", fontWeight: "bold" }}
                              cursor={{ fill: '#f8fafc' }}
                            />
                            <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                              {stats.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#000' : '#e2e8f0'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="rounded-none border-slate-200 shadow-none print:border-none">
                      <CardHeader className="border-b border-slate-50">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest">Source Channel Composition</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-8 h-[300px] md:h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.sourceData}
                              innerRadius={70}
                              outerRadius={90}
                              paddingAngle={8}
                              dataKey="value"
                            >
                              {stats.sourceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend 
                              verticalAlign="bottom" 
                              align="center"
                              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {includeTable && (
                  <div className="pt-8 md:pt-12 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950">Detailed Operational Audit Log</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reportTasks.length} Logged Units</span>
                    </div>
                    <div className="border border-slate-200 rounded-none overflow-x-auto bg-white">
                      <table className="w-full text-left text-[10px] border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="font-bold text-slate-950 uppercase tracking-wider">
                            <th className="px-6 py-5 border border-slate-200 w-16 text-center">#</th>
                            <th className="px-6 py-5 border border-slate-200">Address - Title</th>
                            <th className="px-6 py-5 border border-slate-200">Category</th>
                            <th className="px-6 py-5 border border-slate-200">State</th>
                            <th className="px-6 py-5 border border-slate-200">Source</th>
                            <th className="px-6 py-5 border border-slate-200">Date Basis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportTasks.map((task, idx) => (
                            <tr key={task.id} className="text-slate-900 font-medium bg-white">
                              <td className="px-6 py-4 border border-slate-200 text-center font-bold">{idx + 1}</td>
                              <td className="px-6 py-4 border border-slate-200 font-bold">
                                <div className="flex flex-col">
                                  <span className="text-slate-950">{task.siteAddressStreet}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{task.title}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 border border-slate-200 uppercase font-bold">{task.workItemType}</td>
                              <td className="px-6 py-4 border border-slate-200 uppercase font-bold">
                                {task.overallWorkStatus}
                              </td>
                              <td className="px-6 py-4 border border-slate-200 uppercase font-bold text-slate-500">{task.source}</td>
                              <td className="px-6 py-4 border border-slate-200 text-slate-950 font-bold">
                                {task[basis] ? format(new Date(task[basis]), "yyyy-MM-dd") : 'PENDING'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="hidden print:flex flex-col items-center pt-24 gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Generated via TrackIt Workspace</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200">{mounted ? format(new Date(), "PPPP p") : ""}</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </div>
  )
}
