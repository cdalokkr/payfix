import { Metadata } from "next";
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { BusinessProfileManager } from "@/features/organization/components/BusinessProfileManager";

export const metadata: Metadata = {
  title: "Company Profile & Logo | Admin Dashboard",
  description: "Manage tenant business logo, legal credentials, tax identification, and report letterhead styling.",
};

export default function AdminBusinessProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardPageLayout
        heading="Company Profile & Branding"
        description="Add, update, or remove your business logo and configure official details for reports, payslips, web, and PWA."
      >
        <ErrorBoundary level="section">
          <BusinessProfileManager />
        </ErrorBoundary>
      </DashboardPageLayout>
    </div>
  );
}
