
"use client"

import * as React from "react"
import Link from "next/link"
import { 
  LayoutDashboard, 
  CheckSquare,
  LogOut
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { signOut } from "firebase/auth"
import { Button } from "@/components/ui/button"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: CheckSquare, label: "Workspace", href: "/tasks" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const { user } = useUser()
  const { setOpenMobile, isMobile } = useSidebar()

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar variant="inset" className="border-r border-slate-100 bg-white">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-none bg-primary flex items-center justify-center shadow-sm">
            <CheckSquare className="text-white h-6 w-6" />
          </div>
          <span className="text-xl font-headline font-bold tracking-tighter text-slate-950 uppercase">TrackIt</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href} 
                  tooltip={item.label} 
                  className="h-11 rounded-none px-4"
                  onClick={handleNavClick}
                >
                  <Link href={item.href}>
                    <item.icon className={pathname === item.href ? "text-primary" : "text-slate-400"} />
                    <span className="font-bold text-slate-900 uppercase tracking-tight text-[12px]">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-50">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">Session</span>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-8 w-8 rounded-none bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 uppercase">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-slate-950 truncate uppercase tracking-tight">
                  {user?.displayName || 'Authorized User'}
                </span>
                <span className="text-[10px] text-slate-400 truncate lowercase font-medium leading-none">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => signOut(auth)}
            className="w-full justify-start rounded-none h-10 px-4 text-slate-500 hover:text-destructive hover:bg-destructive/5 font-bold uppercase text-[11px] tracking-widest group"
          >
            <LogOut className="h-4 w-4 mr-3 group-hover:text-destructive transition-colors" />
            Sign Out
          </Button>
          <div className="px-2 pt-2 border-t border-slate-50">
            <span className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">Workspace v1.0</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
