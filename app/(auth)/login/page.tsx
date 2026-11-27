import { LoginForm } from "@/components/auth/login-form";
import AuthShell from "@/components/auth/AuthShell";

export const metadata = {
  title: "Login - NIYAMO",
  description: "Sign in to your secure NIYAMO workspace",
};

export default async function LoginPage() {
  return (
    <AuthShell variant="login">
      <LoginForm />
    </AuthShell>
  );
}
