import type { Metadata } from "next";
import { AdminUsersList } from "@/components/admin/admin-users-list";
import { listAdminUsers } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Users · Admin · Casefolio",
};

export default async function AdminUsersPage() {
  const { user } = await requireAdmin("/admin/users");
  const users = await listAdminUsers();

  return <AdminUsersList initialUsers={users} currentAdminId={user.id} />;
}
