import { LoginForm } from "@/components/auth/login-form";
import AuthShell from "@/components/auth/AuthShell";

export const metadata = {
  title: "Login - PayFix",
  description: "Sign in to your secure workspace",
};

export default async function LoginPage() {
  return (
    <AuthShell variant="login">
      <LoginForm />
    </AuthShell>
  );
}
