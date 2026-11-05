import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminUserDetailPanel } from "@/components/admin/admin-user-detail-panel";
import { getAdminUserDetail } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "User Detail · Admin · Casefolio",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireAdmin(`/admin/users/${id}`);

  const detail = await getAdminUserDetail(id);
  if (!detail) {
    notFound();
  }

  return <AdminUserDetailPanel detail={detail} currentAdminId={user.id} />;
}
