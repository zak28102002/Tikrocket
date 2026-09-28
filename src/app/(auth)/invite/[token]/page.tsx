import Link from "next/link";
import { AuthCard, AuthForm } from "@/components/pulse/auth-form";
import { inviteInfo } from "@/server/services/auth";

export const metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await inviteInfo(token);
  if (!info) {
    return (
      <AuthCard title="Invite expired" subtitle="This link is no longer valid. Ask an admin for a new one.">
        <Link href="/login" className="block text-center text-[13px] font-medium text-accent">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={`Join ${info.workspace}`} subtitle={`You've been invited as ${info.role.toLowerCase()}.`}>
      <AuthForm
        endpoint="/api/v1/auth/invite"
        submitLabel={info.existingUser ? "Join workspace" : "Create account"}
        extra={{ token }}
        fields={[
          { name: "email", label: "Email", type: "email", defaultValue: info.email, readOnly: true },
          ...(info.existingUser ? [] : [{ name: "name", label: "Your name", autoComplete: "name" }]),
          {
            name: "password",
            label: info.existingUser ? "Your password" : "Choose a password",
            type: "password",
            autoComplete: info.existingUser ? "current-password" : "new-password",
            hint: info.existingUser ? undefined : "At least 10 characters.",
          },
        ]}
      />
    </AuthCard>
  );
}
