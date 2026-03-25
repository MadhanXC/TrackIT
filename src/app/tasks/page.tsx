'use client';

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, where } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Loader2, 
  Eye, 
  Pencil, 
  Trash2,
  List as ListIcon,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  ClipboardCheck,
  FileText,
  RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NewTaskDialog } from "@/components/dashboard/new-task-dialog"
import { EditTaskDialog } from "@/components/dashboard/edit-task-dialog"
import { ReportDialog } from "@/components/dashboard/report-dialog"
import { cn } from "@/lib/utils"
import { deleteDocumentNonBlocking } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import * as React from "react"

const ITEMS_PER_PAGE = 15;

const PRIORITY_RANK: Record<string, number> = {
  'Urgent': 3,
  'High': 2,
  'Medium': 1,
  'Low': 0,
};

export default function TasksPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = React.useState<'card' | 'list'>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [priorityFilter, setPriorityFilter] = React.useState('all');
  const [sourceFilter, setSourceFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState('newest');
  const [currentPage, setCurrentPage] = React.useState(1);

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
    let filtered = [...rawTasks];
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(lowerSearch)) || 
        (t.siteAddressStreet && t.siteAddressStreet.toLowerCase().includes(lowerSearch))
      );
    }
    
    if (statusFilter !== 'all') filtered = filtered.filter(t => t.overallWorkStatus === statusFilter);
    if (typeFilter !== 'all') filtered = filtered.filter(t => t.workItemType === typeFilter);
    if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter);
    if (sourceFilter !== 'all') filtered = filtered.filter(t => t.source === sourceFilter);

    return filtered.sort((a, b) => {
      const isACompleted = a.overallWorkStatus === 'Completed';
      const isBCompleted = b.overallWorkStatus === 'Completed';
      
      if (isACompleted && !isBCompleted) return 1;
      if (!isACompleted && isBCompleted) return -1;
      
      switch (sortBy) {
        case 'address-asc':
          return (a.siteAddressStreet || '').localeCompare(b.siteAddressStreet || '');
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'priority-desc':
          return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [rawTasks, searchTerm, statusFilter, typeFilter, priorityFilter, sourceFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / ITEMS_PER_PAGE));
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setPriorityFilter('all');
    setSourceFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleDelete = (taskId: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'workItems', taskId));
    toast({ title: "Removed", description: `Item removed.` });
  };

  return (
    <div className="flex min-h-screen bg-white w-full">
      <AppSidebar />
      <SidebarInset className="flex flex-col flex-1">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-slate-100 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="flex flex-col border-l-4 border-primary pl-3">
              <h1 className="text-sm md:text-lg font-bold text-slate-950 font-headline uppercase tracking-tight">Workspace</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Active Pipeline Management</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ReportDialog />
            <NewTaskDialog />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          <div className="mb-6 md:mb-10 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-2xl w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Filter by location or title..." 
                  className="pl-11 h-12 border-slate-200 shadow-none rounded-none text-slate-950 font-bold focus:border-primary transition-all w-full" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleResetFilters} 
                  className="h-12 rounded-none border-slate-200 text-[10px] font-bold uppercase tracking-widest px-4 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset
                </Button>
                <div className="flex items-center gap-1 border border-slate-200 rounded-none p-1 h-12 bg-white">
                  <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className="h-10 w-10 rounded-none"><ListIcon className="h-4 w-4" /></Button>
                  <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('card')} className="h-10 w-10 rounded-none"><LayoutGrid className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 border-slate-200 font-bold text-slate-950 rounded-none uppercase text-[9px] tracking-widest">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All Status</SelectItem>
                  {['Pending', 'In Progress', 'On Hold', 'Completed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-10 border-slate-200 font-bold text-slate-950 rounded-none uppercase text-[9px] tracking-widest">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Job">Jobs Only</SelectItem>
                  <SelectItem value="Project">Projects Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-10 border-slate-200 font-bold text-slate-950 rounded-none uppercase text-[9px] tracking-widest">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All Priority</SelectItem>
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-10 border-slate-200 font-bold text-slate-950 rounded-none uppercase text-[9px] tracking-widest">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All Sources</SelectItem>
                  {['Call', 'Email', 'Text', 'In-person'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 border-primary/20 bg-slate-50 font-bold text-primary rounded-none uppercase text-[9px] tracking-widest">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="address-asc">Address (A-Z)</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="priority-desc">Priority (High-Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {filteredTasks.length} Resulting Items
              </span>
            </div>
          </div>

          <div className="mb-12 md:mb-16">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-slate-200" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Syncing Workspace...</p>
              </div>
            ) : !paginatedTasks.length ? (
              <div className="rounded-none border border-dashed border-slate-200 py-16 md:py-32 px-4 text-center bg-slate-50">
                <h3 className="text-slate-950 font-bold mb-2">No items in scope</h3>
                <p className="text-xs text-slate-500 mb-6 uppercase tracking-widest">Adjust filters or search parameters.</p>
                <Button variant="outline" size="sm" onClick={handleResetFilters} className="font-bold border-slate-950 rounded-none uppercase text-[10px] tracking-widest px-6 h-10">Reset Filters</Button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="rounded-none border border-slate-200 overflow-x-auto bg-white scrollbar-hide">
                <Table className="min-w-full md:min-w-[1400px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200 hidden md:table-header-group">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-slate-950 py-5 pl-8 w-12 text-center text-[10px] tracking-widest">#</TableHead>
                      <TableHead className="font-bold text-slate-950 py-5 uppercase w-1/4 text-[10px] tracking-widest">Address - Title</TableHead>
                      <TableHead className="font-bold text-slate-950 py-5 uppercase text-[10px] tracking-widest">Task Details</TableHead>
                      <TableHead className="font-bold text-slate-950 py-5 uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                      <TableHead className="font-bold text-slate-950 py-5 text-right pr-8 uppercase text-[10px] tracking-widest">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map((task, index) => {
                      const sequentialNumber = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                      return (
                        <TableRow key={task.id} className="hover:bg-slate-50/50 border-slate-100 group transition-all flex flex-col md:table-row p-4 md:p-0">
                          <TableCell className="py-6 pl-8 font-bold text-slate-400 text-[10px] text-center hidden md:table-cell">{sequentialNumber}</TableCell>
                          <TableCell className="py-2 md:py-6 align-top">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold text-slate-950 text-sm md:text-base leading-tight tracking-tight">
                                {task.siteAddressStreet} - {task.title}
                              </span>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[9px] font-bold text-slate-500 border-slate-200 rounded-none uppercase">{task.workItemType}</Badge>
                                <Badge variant="outline" className={cn(
                                  "text-[9px] font-bold border-none rounded-none uppercase",
                                  task.priority === 'Urgent' ? "bg-red-50 text-red-700" : "text-slate-500 border-slate-200"
                                )}>
                                  {task.priority}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-bold text-slate-500 border-slate-200 rounded-none uppercase">Source: {task.source}</Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 md:py-6 align-top">
                            <div className="flex flex-wrap gap-2 max-w-md">
                              {task.permitRequired && (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className="text-[9px] font-bold bg-white text-slate-950 border-slate-200 rounded-none h-6 uppercase">Permit: {task.permitStatus}</Badge>
                                  <span className="text-[8px] font-bold text-primary uppercase ml-1">By: {task.permitHandler}</span>
                                </div>
                              )}
                              {task.surveyRequired && (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className="text-[9px] font-bold bg-white text-slate-950 border-slate-200 rounded-none h-6 uppercase">Survey: {task.surveyStatus}</Badge>
                                  <span className="text-[8px] font-bold text-primary uppercase ml-1">By: {task.surveyHandler}</span>
                                </div>
                              )}
                              {task.materialsRequired && (
                                <Badge variant="outline" className="text-[9px] font-bold bg-white text-slate-950 border-slate-200 rounded-none h-6 uppercase">Materials: {task.materialsList?.length || 0}</Badge>
                              )}
                              {task.shipmentRequired && (
                                <Badge variant="outline" className="text-[9px] font-bold bg-slate-950 text-white border-none rounded-none h-6 uppercase px-2 flex items-center gap-1.5">
                                  <Truck className="h-2.5 w-2.5" />
                                  {task.shipmentStatus}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 md:py-6 align-top">
                            <div className="flex flex-row md:flex-col gap-1 items-center justify-between md:justify-center">
                              <Badge className={cn("text-[10px] font-bold rounded-none h-6 uppercase px-3", task.overallWorkStatus === 'Completed' ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-950 border-none")}>
                                {task.overallWorkStatus}
                              </Badge>
                              <div className="flex flex-col gap-0.5 mt-1 text-right md:text-center">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Created: {task.createdAt ? format(new Date(task.createdAt), "MM/dd/yy") : '—'}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{task.dateInitiated ? `Started: ${task.dateInitiated}` : ''}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 md:py-6 text-right pr-0 md:pr-8 align-top">
                            <div className="flex justify-end gap-1 md:opacity-20 md:group-hover:opacity-100 transition-opacity">
                              <EditTaskDialog task={task} readOnly={true} trigger={<Button variant="ghost" size="icon" className="h-9 w-9 text-slate-950 hover:bg-slate-100 rounded-none"><Eye className="h-4 w-4" /></Button>} />
                              <EditTaskDialog task={task} trigger={<Button variant="ghost" size="icon" className="h-9 w-9 text-slate-950 hover:bg-slate-100 rounded-none"><Pencil className="h-4 w-4" /></Button>} />
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/5 rounded-none"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent className="rounded-none border-slate-200">
                                  <AlertDialogHeader><AlertDialogTitle className="font-bold text-slate-950">Remove Entry?</AlertDialogTitle></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="font-bold rounded-none border-slate-200">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(task.id)} className="bg-destructive text-white font-bold rounded-none">Confirm</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                {paginatedTasks.map((task, index) => {
                  const sequentialNumber = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  return (
                    <div key={task.id} className="border border-slate-200 rounded-none p-6 bg-white hover:border-primary transition-all group flex flex-col h-full relative">
                      <div className="absolute top-4 right-4 text-[9px] font-bold text-slate-200">{sequentialNumber}</div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-bold text-slate-400 border-slate-100 rounded-none uppercase tracking-widest">{task.workItemType}</Badge>
                            <Badge className={cn(
                              "text-[8px] font-bold border-none rounded-none uppercase",
                              task.priority === 'Urgent' ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
                            )}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <EditTaskDialog task={task} readOnly={true} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-950"><Eye className="h-4 w-4" /></Button>} />
                          <EditTaskDialog task={task} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-950"><Pencil className="h-4 w-4" /></Button>} />
                        </div>
                      </div>
                      <div className="flex-1 space-y-3 mb-8">
                        <h3 className="text-base md:text-lg font-bold text-slate-950 leading-tight group-hover:text-primary transition-colors tracking-tight">
                          {task.siteAddressStreet}
                        </h3>
                        <p className="text-xs font-bold text-slate-500">{task.title}</p>
                        <p className="text-xs font-medium text-slate-400 line-clamp-2 leading-relaxed mt-2">{task.description}</p>
                      </div>
                      
                      <div className="space-y-4 pt-6 border-t border-slate-50">
                        <div className="grid grid-cols-2 gap-2">
                          {task.permitRequired && <div className="flex items-center gap-1.5"><ClipboardCheck className="h-3 w-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-950 uppercase">Permit: {task.permitStatus}</span></div>}
                          {task.surveyRequired && <div className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-950 uppercase">Survey: {task.surveyStatus}</span></div>}
                          {task.materialsRequired && <div className="flex items-center gap-1.5"><Package className="h-3 w-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-950 uppercase">Inv: {task.materialsList?.length || 0}</span></div>}
                          {task.shipmentRequired && <div className="flex items-center gap-1.5"><Truck className="h-3 w-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-950 uppercase">{task.shipmentStatus}</span></div>}
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <Badge className={cn("text-[9px] font-bold rounded-none border-none px-3 uppercase tracking-widest", task.overallWorkStatus === 'Completed' ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-950")}>
                            {task.overallWorkStatus}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{task.dateInitiated || 'Not Commenced'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {filteredTasks.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 py-12 border-t border-slate-100 mt-8">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1} 
                onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0 }); }} 
                className="w-full md:w-auto font-bold rounded-none border-slate-200 h-10 px-6 uppercase text-[10px] tracking-widest"
              >
                <ChevronLeft className="h-4 w-4 mr-2" /> Previous
              </Button>
              <span className="text-[10px] font-bold text-slate-950 uppercase tracking-widest min-w-[120px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages} 
                onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0 }); }} 
                className="w-full md:w-auto font-bold rounded-none border-slate-200 h-10 px-6 uppercase text-[10px] tracking-widest"
              >
                Next <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </main>
      </SidebarInset>
    </div>
  )
}
