import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/session";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <AppShell
      viewer={{
        user: viewer.user,
        workspace: viewer.workspace,
        role: viewer.role,
        workspaces: viewer.workspaces,
      }}
    >
      {children}
    </AppShell>
  );
}
