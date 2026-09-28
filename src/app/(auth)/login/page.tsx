import { redirect } from "next/navigation";
import { AuthCard, AuthForm } from "@/components/pulse/auth-form";
import { needsSetup } from "@/server/services/auth";
import { getViewer } from "@/server/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getViewer()) redirect("/");
  if (await needsSetup()) {
    return (
      <AuthCard title="Set up Pulse" subtitle="Create the first admin account for your team.">
        <AuthForm
          endpoint="/api/v1/auth/setup"
          submitLabel="Create workspace"
          fields={[
            { name: "name", label: "Your name", autoComplete: "name", placeholder: "Alex Kim" },
            { name: "email", label: "Work email", type: "email", autoComplete: "email", placeholder: "you@company.com" },
            { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." },
            { name: "workspace", label: "Workspace name", placeholder: "Acme Apps" },
          ]}
        />
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your Pulse workspace." footer="Need access? Ask a workspace admin for an invite link.">
      <AuthForm
        endpoint="/api/v1/auth/login"
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthCard>
  );
}
