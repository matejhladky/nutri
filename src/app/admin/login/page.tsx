import { LoginForm } from "@/components/LoginForm";

export const metadata = { robots: { index: false } };

export default function AdminLoginPage() {
  return <LoginForm endpoint="/api/admin/login" next="/admin" subtitle="Správa" />;
}
