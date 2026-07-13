import RegisterWizard from "@/components/auth/RegisterWizard";
import AuthShell from "@/components/auth/AuthShell";

export const metadata = {
  title: "Register - PayFix",
  description: "Create your secure company workspace",
};

export default async function SignupPage() {
  return (
    <AuthShell variant="register">
      <RegisterWizard />
    </AuthShell>
  );
}
