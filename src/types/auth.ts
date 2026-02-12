export type Role = "admin" | "teacher" | "teacher_manager" | "donor_manager";

export type Permission =
  | "users:view"
  | "users:invite"
  | "users:deactivate"
  | "orphanages:view"
  | "orphanages:edit"
  | "class_logs:view_all"
  | "class_logs:create"
  | "class_logs:edit_own"
  | "class_logs:edit_all"
  | "class_logs:delete_own"
  | "class_logs:delete_all"
  | "events:view"
  | "events:manage"
  | "donations:view"
  | "transparency:view"
  | "transparency:generate"
  | "transparency:publish"
  | "media:upload"
  | "logs:view";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image: string;
  roles: Role[];
}
