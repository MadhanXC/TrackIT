
"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Circle, Clock, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"

const tasks = [
  { 
    id: 1, 
    title: "Finalize Marketing Deck", 
    space: "Product Launch", 
    status: "In Progress", 
    priority: "High",
    due: "2h left"
  },
  { 
    id: 2, 
    title: "Client Feedback Sync", 
    space: "Client Services", 
    status: "Review", 
    priority: "Medium",
    due: "Tomorrow"
  },
  { 
    id: 3, 
    title: "Database Migration Schema", 
    space: "Backend Infrastructure", 
    status: "Todo", 
    priority: "Urgent",
    due: "Today"
  },
  { 
    id: 4, 
    title: "Update Brand Guidelines", 
    space: "Design Sprint", 
    status: "Completed", 
    priority: "Low",
    due: "Done"
  },
]

export function RecentTasks() {
  return (
    <Card className="col-span-full lg:col-span-4 shadow-modern border-none bg-white/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recent Tasks</CardTitle>
        <Button variant="ghost" size="sm" className="text-primary font-semibold">View All</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className="flex items-center gap-4 p-3 rounded-xl border border-border/40 hover:bg-white hover:shadow-sm transition-all group"
            >
              <div className="mt-0.5">
                {task.status === "Completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary cursor-pointer transition-colors" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{task.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground truncate">{task.space}</span>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {task.due}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-[10px] h-5 px-1.5 font-bold uppercase",
                    task.priority === "Urgent" && "bg-rose-100 text-rose-700",
                    task.priority === "High" && "bg-orange-100 text-orange-700",
                    task.priority === "Medium" && "bg-blue-100 text-blue-700",
                    task.priority === "Low" && "bg-slate-100 text-slate-700",
                  )}
                >
                  {task.priority}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
