// Login page gets its own layout - no sidebar, no AppShell
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
