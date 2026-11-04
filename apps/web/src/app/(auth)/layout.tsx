import type { ReactNode } from "react";
import { AuthSplitShell } from "@/components/layout/auth-split-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplitShell>{children}</AuthSplitShell>;
}
