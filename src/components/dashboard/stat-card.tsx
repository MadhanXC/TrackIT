"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string
  change: string
  icon: LucideIcon
  trend: "up" | "down" | "neutral"
  className?: string
}

export function StatCard({ title, value, change, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-slate-200 shadow-none rounded-none bg-white group", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-none bg-accent group-hover:bg-primary/10 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            {change}
          </span>
        </div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-2xl font-bold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  )
}