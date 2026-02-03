"use client"

import * as React from "react"
import {
  IconBuildingSkyscraper,
  IconHelp,
  IconInnerShadowTop,
  IconLayoutDashboard,
  IconMail,
  IconNetwork,
  IconRocket,
  IconSettings,
  IconUsers,
  IconUserSearch,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/sourcing",
      icon: IconLayoutDashboard,
    },
    {
      title: "Auto-Discover",
      url: "/sourcing/discover",
      icon: IconRocket,
    },
    {
      title: "Startups",
      url: "/sourcing/startups",
      icon: IconBuildingSkyscraper,
    },
    {
      title: "Founders",
      url: "/sourcing/founders",
      icon: IconUserSearch,
    },
    {
      title: "Outreach",
      url: "/sourcing/outreach",
      icon: IconMail,
    },
    {
      title: "VC Network",
      url: "/sourcing/vcs",
      icon: IconNetwork,
    },
    {
      title: "Introductions",
      url: "/sourcing/introductions",
      icon: IconUsers,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/sourcing/settings",
      icon: IconSettings,
    },
    {
      title: "Help",
      url: "#",
      icon: IconHelp,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/sourcing">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Trendistrict</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
