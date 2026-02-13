"use client";

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
}

interface NavItem {
  label: string;
  href: string;
  permission?: Parameters<typeof hasPermission>[1];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Users", href: "/admin/users", permission: "users:view" },
  { label: "Orphanages", href: "/admin/orphanages", permission: "orphanages:view" },
  { label: "Classes", href: "/admin/classes", permission: "class_logs:view_all" },
  { label: "Events", href: "/admin/events", permission: "events:view" },
  { label: "Donations", href: "/admin/donations", permission: "donations:view" },
  { label: "Reports", href: "/admin/transparency", permission: "transparency:view" },
  { label: "Media", href: "/admin/media", permission: "media:upload" },
  { label: "Logs", href: "/admin/logs", permission: "logs:view" },
  { label: "API Costs", href: "/admin/costs", permission: "costs:view" },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(user.roles, item.permission)
  );

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-warmgray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-warmgray-200 px-6">
        <Link href="/admin" className="font-bold text-warmgray-900">
          MFG Admin
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-warmgray-600 hover:bg-warmgray-50 hover:text-warmgray-900"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-warmgray-200 p-4">
        <div className="flex items-center gap-3">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warmgray-200 text-xs font-medium text-warmgray-600">
              {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-warmgray-900">
              {user.name || "User"}
            </p>
            <p className="truncate text-xs text-warmgray-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="mt-3 w-full rounded-lg border border-warmgray-200 px-3 py-1.5 text-xs font-medium text-warmgray-600 transition-colors hover:bg-warmgray-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
