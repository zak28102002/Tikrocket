import { Providers } from "@/components/providers";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, var(--accent-softer), transparent 70%), radial-gradient(40% 30% at 80% 100%, var(--accent-softer), transparent 70%)",
          }}
        />
        <div className="relative w-full max-w-[380px]">{children}</div>
      </div>
    </Providers>
  );
}
