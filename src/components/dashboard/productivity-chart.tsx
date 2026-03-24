"use client"

import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const data = [
  { day: "Mon", tasks: 12, completed: 8 },
  { day: "Tue", tasks: 15, completed: 10 },
  { day: "Wed", tasks: 18, completed: 15 },
  { day: "Thu", tasks: 22, completed: 14 },
  { day: "Fri", tasks: 16, completed: 13 },
  { day: "Sat", tasks: 8, completed: 7 },
  { day: "Sun", tasks: 10, completed: 9 },
]

export function ProductivityChart() {
  return (
    <Card className="col-span-full lg:col-span-8 border-slate-200 shadow-none rounded-sm">
      <CardHeader className="border-b border-slate-50 pb-4">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-950">Analytics Trend</CardTitle>
        <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Operational output across the timeline</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full p-6">
        <ChartContainer
          config={{
            tasks: { label: "TOTAL", color: "hsl(var(--primary))" },
            completed: { label: "COMPLETED", color: "hsl(var(--muted-foreground))" },
          }}
          className="h-full w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }} 
                dy={10}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="tasks"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTasks)"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#94a3b8"
                strokeWidth={2}
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}