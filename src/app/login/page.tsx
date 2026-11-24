import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return <LoginForm endpoint="/api/login" next="/" subtitle="Příprava na zkoušku výživové poradkyně" />;
}
