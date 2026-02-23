"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";

interface SidebarProps {
  user: {
    name: string;
    email: string;
    image: string;
    roles: Role[];
  };
  onClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  permission?: Parameters<typeof hasPermission>[1];
}

/* Dashboard — standalone at top, no section header */
const dashboardItems: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
];

/* Operations — core charity work */
const operationsItems: NavItem[] = [
  { label: "Orphanages", href: "/admin/orphanages", permission: "orphanages:view" },
  { label: "Kids", href: "/admin/kids", permission: "kids:view" },
  { label: "Classes", href: "/admin/classes", permission: "class_logs:view_all" },
  { label: "Events", href: "/admin/events", permission: "events:view" },
  { label: "Transparency Reports", href: "/admin/transparency", permission: "transparency:view" },
];

/* Fundraising */
const fundraisingItems: NavItem[] = [
  { label: "Donations", href: "/admin/donations", permission: "donations:view" },
  { label: "Donor Platforms", href: "/admin/platforms", permission: "donations:view" },
];

/* Finance — banking & invoicing */
const financeItems: NavItem[] = [
  { label: "Accounts", href: "/admin/banking", permission: "banking:view" },
  { label: "Invoices", href: "/admin/invoices", permission: "invoices:view" },
];

/* Developer */
const developerItems: NavItem[] = [
  { label: "Logs", href: "/admin/logs", permission: "logs:view" },
  { label: "API Costs", href: "/admin/costs", permission: "costs:view" },
  { label: "Media", href: "/admin/media", permission: "media:upload" },
];

/* Settings — admin & teacher_manager only */
const settingsItems: NavItem[] = [
  { label: "Users", href: "/admin/users", permission: "users:view" },
];

export default function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();

  const filterItems = (items: NavItem[]) =>
    items.filter(
      (item) => !item.permission || hasPermission(user.roles, item.permission)
    );

  const renderItem = (item: NavItem) => {
    const isActive =
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname.startsWith(item.href);

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? "bg-sand-100 text-sand-900"
              : "text-sand-600 hover:bg-sand-50 hover:text-sand-900"
          }`}
        >
          {item.label}
        </Link>
      </li>
    );
  };

  const renderSection = (label: string, items: NavItem[]) => {
    const visible = filterItems(items);
    if (visible.length === 0) return null;
    return (
      <>
        <div className="mt-6 mb-2 px-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sand-400">
            {label}
          </p>
        </div>
        <ul className="space-y-1">
          {visible.map(renderItem)}
        </ul>
      </>
    );
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sand-200 bg-white">
      {/* Logo — green banner */}
      <div className="flex h-16 items-center bg-green-700 px-6">
        <Link href="/admin" className="block">
          <Image
            src="/logo-white.svg"
            alt="Meant for Greatness"
            width={180}
            height={24}
            priority
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Dashboard — no section header */}
        <ul className="space-y-1">
          {filterItems(dashboardItems).map(renderItem)}
        </ul>

        {renderSection("Operations", operationsItems)}
        {renderSection("Fundraising", fundraisingItems)}
        {renderSection("Finance", financeItems)}
        {renderSection("Developer", developerItems)}
        {renderSection("Settings", settingsItems)}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-sand-200 p-4">
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-8 w-8 rounded-full ring-2 ring-sand-200"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700 text-xs font-medium text-white">
              {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-sand-900">
              {user.name || "User"}
            </p>
            <p className="truncate text-xs text-sand-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="mt-3 w-full rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-sand-600 transition-colors hover:bg-sand-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
