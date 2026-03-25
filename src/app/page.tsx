
"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { 
  Zap, 
  Clock3, 
  BarChart3,
  Loader2,
  Eye,
  Pencil,
  Plus,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/dashboard/stat-card"
import { NewTaskDialog } from "@/components/dashboard/new-task-dialog"
import { EditTaskDialog } from "@/components/dashboard/edit-task-dialog"
import { ReportDialog } from "@/components/dashboard/report-dialog"
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { collection, query, doc, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import * as React from "react"

export default function Dashboard() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [todoTitle, setTodoTitle] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Optimized query for recent tasks
  const recentTasksQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(
      collection(firestore, 'workItems'), 
      where('userId', '==', user.uid)
    );
  }, [firestore, isUserLoading, user]);

  const { data: rawTasks, isLoading: tasksLoading } = useCollection(recentTasksQuery);

  const todosQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'todos'));
  }, [firestore, isUserLoading, user]);

  const { data: todos, isLoading: todosLoading } = useCollection(todosQuery);

  const activeTasksCount = React.useMemo(() => {
    return rawTasks?.filter(t => t.overallWorkStatus !== 'Completed').length || 0;
  }, [rawTasks]);

  const completedTasksCount = React.useMemo(() => {
    return rawTasks?.filter(t => t.overallWorkStatus === 'Completed').length || 0;
  }, [rawTasks]);

  // Client-side sorting by latest entered or edited
  const sortedTasks = React.useMemo(() => {
    if (!rawTasks) return [];
    return [...rawTasks].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [rawTasks]);

  const sortedTodos = React.useMemo(() => {
    if (!todos) return [];
    return [...todos].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [todos]);

  const firstName = React.useMemo(() => {
    if (!user?.displayName) return 'User';
    const name = user.displayName.split(' ')[0];
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }, [user]);

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim() || !firestore || !user) return;
    addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'todos'), {
      title: todoTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    });
    setTodoTitle("");
  };

  const handleToggleTodo = (todo: any) => {
    if (!firestore || !user) return;
    updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'todos', todo.id), {
      completed: !todo.completed
    });
  };

  const handleDeleteTodo = (todoId: string) => {
    if (!firestore || !user) return;
    deleteDocumentNonBlocking(doc(firestore, 'users', user.uid, 'todos', todoId));
  };

  return (
    <div className="flex min-h-screen bg-white w-full">
      <AppSidebar />
      <SidebarInset className="flex flex-col flex-1">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-[15px] md:text-[18px] font-bold text-slate-950 font-headline uppercase tracking-tight">Dashboard</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Operational Overview</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ReportDialog />
            <NewTaskDialog />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col">
          <div className="mb-8 md:mb-10">
            {mounted ? (
              <>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-950 tracking-tighter uppercase">Hi {firstName}</h2>
                <p className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">{activeTasksCount} active items</p>
              </>
            ) : (
              <div className="h-10 w-48 bg-slate-50 animate-pulse" />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
            {/* Stat Cards */}
            <div className="col-span-full order-last md:order-first">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Active" value={activeTasksCount.toString()} change="Current items" trend="neutral" icon={Zap} />
                <StatCard title="Total" value={(rawTasks?.length || 0).toString()} change="Lifetime items" trend="neutral" icon={Clock3} />
                <StatCard title="Completed" value={completedTasksCount.toString()} change="Closed items" trend="up" icon={BarChart3} />
              </div>
            </div>

            {/* Quick Tasks */}
            <div className="col-span-full md:col-span-4 order-1 md:order-none">
              <Card className="border-slate-300 shadow-none rounded-none bg-white">
                <CardHeader className="bg-slate-950 border-b-0 py-3">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-white">Quick Tasks</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 px-4 pb-4">
                  <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
                    <input 
                      placeholder="Add personal todo..." 
                      className="flex h-11 w-full bg-background px-3 py-2 text-[13px] rounded-none border border-slate-200 font-bold uppercase tracking-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      value={todoTitle}
                      onChange={(e) => setTodoTitle(e.target.value)}
                    />
                    <Button type="submit" size="icon" className="h-11 w-11 bg-slate-950 rounded-none shrink-0">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </form>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
                    {todosLoading ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-200" />
                      </div>
                    ) : sortedTodos.length === 0 ? (
                      <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-4">No quick tasks</p>
                    ) : (
                      sortedTodos.map((todo) => (
                        <div key={todo.id} className="group flex items-center justify-between p-2 bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox 
                              checked={todo.completed} 
                              onCheckedChange={() => handleToggleTodo(todo)} 
                              className="rounded-none border-slate-300 data-[state=checked]:bg-slate-950 data-[state=checked]:border-slate-950" 
                            />
                            <span className={cn(
                              "text-[13px] font-bold uppercase tracking-tight truncate", 
                              todo.completed ? "text-slate-300 line-through" : "text-slate-900"
                            )}>
                              {todo.title}
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-300 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={() => handleDeleteTodo(todo.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Entries */}
            <div className="col-span-full md:col-span-8 order-2 md:order-none">
              <Card className="border-slate-300 shadow-none rounded-none h-full bg-white">
                <CardHeader className="flex flex-row items-center justify-between bg-slate-950 border-b-0 py-3">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-white">Recent Entries</CardTitle>
                  <Link href="/tasks">
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Full View</Button>
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-200">
                    {tasksLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Syncing Pipeline...</p>
                      </div>
                    ) : sortedTasks.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <p>No records found.</p>
                      </div>
                    ) : (
                      sortedTasks.slice(0, 10).map((task) => (
                        <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-3">
                          <div className="flex flex-col gap-0.5">
                            <h4 className="text-[13px] font-bold text-slate-950 leading-tight tracking-tight">{task.siteAddressStreet}</h4>
                            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{task.title}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <Badge className={cn(
                              "text-[10px] font-bold border-none rounded-none uppercase px-3 h-6 flex items-center", 
                              task.overallWorkStatus === 'Completed' ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-950"
                            )}>
                              {task.overallWorkStatus}
                            </Badge>
                            <div className="flex gap-1">
                              <EditTaskDialog task={task} readOnly={true} trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>} />
                              <EditTaskDialog task={task} trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>} />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  )
}
