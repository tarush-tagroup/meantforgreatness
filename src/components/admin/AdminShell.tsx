"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import type { Role } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";

interface NavItem {
  label: string;
  href: string;
  permission?: Parameters<typeof hasPermission>[1];
}

/* Dashboard — standalone */
const dashboardItems: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
];

/* Operations */
const operationsItems: NavItem[] = [
  { label: "Orphanages", href: "/admin/orphanages", permission: "orphanages:view" },
  { label: "Kids", href: "/admin/kids", permission: "kids:view" },
  { label: "Classes", href: "/admin/classes", permission: "class_logs:view_all" },
  { label: "Events", href: "/admin/events", permission: "events:view" },
  { label: "Transparency", href: "/admin/transparency", permission: "transparency:view" },
];

/* Fundraising */
const fundraisingItems: NavItem[] = [
  { label: "Donations", href: "/admin/donations", permission: "donations:view" },
  { label: "Donor Platforms", href: "/admin/platforms", permission: "users:view" },
  { label: "Banking", href: "/admin/banking", permission: "banking:view" },
  { label: "Invoices", href: "/admin/invoices", permission: "invoices:view" },
];

/* Developer */
const developerItems: NavItem[] = [
  { label: "Logs", href: "/admin/logs", permission: "logs:view" },
  { label: "Costs", href: "/admin/costs", permission: "costs:view" },
  { label: "Media", href: "/admin/media", permission: "media:upload" },
];

/* Settings */
const settingsItems: NavItem[] = [
  { label: "Users", href: "/admin/users", permission: "users:view" },
];

interface AdminShellProps {
  user: {
    name: string;
    email: string;
    image: string;
    roles: Role[];
  };
  children: React.ReactNode;
}

export default function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();

  const filterItems = (items: NavItem[]) =>
    items.filter(
      (item) => !item.permission || hasPermission(user.roles, item.permission)
    );

  const visibleDashboard = filterItems(dashboardItems);

  const renderPill = (item: NavItem) => {
    const isActive =
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
          isActive
            ? "bg-sand-200 text-sand-900"
            : "text-sand-500 hover:bg-sand-100 hover:text-sand-700"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  const divider = (
    <span className="shrink-0 h-4 w-px bg-sand-200" aria-hidden="true" />
  );

  const renderSection = (items: NavItem[]) => {
    const visible = filterItems(items);
    if (visible.length === 0) return null;
    return (
      <>
        {divider}
        {visible.map(renderPill)}
      </>
    );
  };

  return (
    <div className="flex h-screen bg-sand-50">
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:flex">
        <Sidebar user={user} />
      </div>

      {/* Mobile header — visible below lg */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-sand-200 lg:hidden">
        <div className="flex h-12 items-center overflow-x-auto px-3 gap-1.5 scrollbar-hide">
          {/* Logo */}
          <Link href="/admin" className="shrink-0 mr-1 flex items-center">
            <div className="bg-green-700 rounded-md px-2 py-1">
              <Image
                src="/logo-white.svg"
                alt="Meant for Greatness"
                width={100}
                height={14}
                priority
              />
            </div>
          </Link>

          {divider}

          {/* Dashboard */}
          {visibleDashboard.map(renderPill)}

          {/* Operations */}
          {renderSection(operationsItems)}

          {/* Fundraising */}
          {renderSection(fundraisingItems)}

          {/* Developer */}
          {renderSection(developerItems)}

          {/* Settings */}
          {renderSection(settingsItems)}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-12 lg:pt-0">
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
