"use client";

import React, { useState, useRef } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { 
  CreditCard, Calendar, Users, Receipt, Download, Printer, Eye, 
  CheckCircle2, AlertTriangle, XCircle, Search, ShieldCheck, Building2,
  Clock, ArrowUpRight, HelpCircle, Loader2, X, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminBillingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const printableReceiptRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: subInfo, isLoading: loadingSub, refetch: refetchSub } = trpc.billing.getSubscriptionInfo.useQuery();
  const { data: invoices, isLoading: loadingInvoices, refetch: refetchInvoices } = trpc.billing.getInvoices.useQuery();

  // Filter invoices
  const filteredInvoices = (invoices || []).filter((inv: any) => 
    inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.planName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.date?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Print / Download PDF Handler (Native A4 Print with perfect vector styling)
  const handlePrintReceipt = (inv: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const companyName = subInfo?.companyName || "Workspace Tenant";
    const slug = subInfo?.slug || "workspace";
    const adminEmail = subInfo?.adminEmail || "";
    const adminPhone = subInfo?.adminPhone || "";
    const planName = inv.planName || subInfo?.plan?.displayName || "Subscription Plan";
    const period = inv.periodStart && inv.periodEnd ? `${inv.periodStart} to ${inv.periodEnd}` : 'Standard Workspace Cycle';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tax Invoice & Renewal Receipt - ${inv.id}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm 18mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 13px; line-height: 1.5; }
            .invoice-box { max-width: 800px; margin: 0 auto; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            .logo-title { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #635bff; }
            .badge-paid { display: inline-block; padding: 4px 12px; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .badge-due { display: inline-block; padding: 4px 12px; background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .meta-grid { display: table; width: 100%; margin-bottom: 28px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
            .meta-col { display: table-cell; width: 50%; padding: 18px 20px; vertical-align: top; }
            .meta-col:first-child { border-right: 1px solid #e2e8f0; }
            .meta-heading { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 8px; }
            .meta-text { font-size: 13px; color: #1e293b; margin-bottom: 3px; }
            .meta-highlight { font-weight: 700; color: #0f172a; font-size: 14px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; }
            .items-table th { background: #f1f5f9; padding: 10px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; text-align: left; border-bottom: 1.5px solid #cbd5e1; }
            .items-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .text-right { text-align: right; }
            .totals-table { width: 45%; margin-left: auto; border-collapse: collapse; margin-bottom: 32px; }
            .totals-table td { padding: 6px 12px; font-size: 13px; }
            .grand-total td { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; }
            .notes-card { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 14px 18px; margin-bottom: 28px; }
            .notes-title { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px; }
            .notes-body { font-size: 11.5px; color: #64748b; }
            .footer-info { border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #94a3b8; display: table; width: 100%; }
            .footer-left { display: table-cell; text-align: left; }
            .footer-right { display: table-cell; text-align: right; }
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <!-- Header -->
            <table class="header-table">
              <tr>
                <td style="vertical-align: top;">
                  <div class="logo-title">PayFix</div>
                  <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px;">Automated Workforce & Attendance Cloud Platform</div>
                  <div style="font-size: 11.5px; color: #94a3b8; margin-top: 2px;">Support: billing@payfix.in • portal.payfix.in</div>
                </td>
                <td style="vertical-align: top; text-align: right;">
                  <div style="font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Tax Invoice & Receipt</div>
                  <div style="margin-top: 6px;">
                    <span class="${inv.status.toLowerCase() === 'paid' ? 'badge-paid' : 'badge-due'}">${inv.status.toUpperCase()}</span>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Billed To & Invoice Metadata -->
            <div class="meta-grid">
              <div class="meta-col">
                <div class="meta-heading">Billed To (Tenant Workspace)</div>
                <div class="meta-text meta-highlight">${companyName}</div>
                <div class="meta-text">Workspace Subdomain: <strong>${slug}.payfix.in</strong></div>
                ${adminEmail ? `<div class="meta-text">Primary Admin: ${adminEmail}</div>` : ''}
                ${adminPhone ? `<div class="meta-text">Phone: ${adminPhone}</div>` : ''}
              </div>
              <div class="meta-col">
                <div class="meta-heading">Invoice & Subscription Details</div>
                <div class="meta-text">Invoice Number: <strong style="color: #635bff; font-family: monospace;">${inv.id}</strong></div>
                <div class="meta-text">Billing Date: <strong>${inv.date}</strong></div>
                <div class="meta-text">Subscription Covered: <strong>${period}</strong></div>
                <div class="meta-text">Transaction ID: <code style="font-size: 11px;">${inv.transactionId}</code></div>
                <div class="meta-text">Payment Method: <strong>${inv.paymentMethod}</strong></div>
              </div>
            </div>

            <!-- Itemized Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 55%;">Item & Service Description</th>
                  <th style="width: 15%; text-align: center;">Billing Cycle</th>
                  <th style="width: 15%;" class="text-right">Rate</th>
                  <th style="width: 15%;" class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #0f172a;">${planName}</div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
                      Full SaaS workforce access: Employee directory, Biometric sync, Geofencing, Attendance verification, Duty Roster & Leave workflows.
                    </div>
                  </td>
                  <td style="text-align: center; text-transform: capitalize; color: #475569;">${inv.billingCycle || 'Monthly'}</td>
                  <td class="text-right" style="font-family: monospace;">${inv.amount}</td>
                  <td class="text-right" style="font-weight: 700; font-family: monospace;">${inv.amount}</td>
                </tr>
              </tbody>
            </table>

            <!-- Totals -->
            <table class="totals-table">
              <tr>
                <td style="color: #64748b;">Subtotal</td>
                <td class="text-right" style="font-family: monospace;">${inv.amount}</td>
              </tr>
              <tr>
                <td style="color: #64748b;">Taxes (GST / Direct Service)</td>
                <td class="text-right" style="font-family: monospace;">₹0.00</td>
              </tr>
              <tr class="grand-total">
                <td>Total Paid</td>
                <td class="text-right" style="color: #047857; font-family: monospace;">${inv.amount}</td>
              </tr>
            </table>

            <!-- Renewal & Legal Note -->
            <div class="notes-card">
              <div class="notes-title">Subscription Renewal & Validity Notice</div>
              <div class="notes-body">
                This document serves as an official confirmation of subscription and payment for <strong>${companyName}</strong>. 
                Your workspace license is valid until <strong>${subInfo?.formattedExpiry || 'Scheduled Renewal'}</strong>.
                For inquiries or enterprise quota expansion, contact your designated account representative at PayFix support.
              </div>
            </div>

            <!-- Footer -->
            <div class="footer-info">
              <div class="footer-left">
                Computer-generated receipt • No physical signature required • PayFix SaaS Cloud
              </div>
              <div class="footer-right">
                Printed: ${new Date().toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 text-[#1e293b] dark:text-slate-100 font-sans bg-[#F8FAFC] dark:bg-[#0B131A] min-h-screen transition-colors duration-200">
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-slate-100 tracking-tight leading-none flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-[#635BFF] dark:text-[#0BDBB9]" />
            Workspace Subscription & Billing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage your subscription tier, license renewal schedule, and view or download official billing invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={() => { refetchSub(); refetchInvoices(); }}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121B22] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics (4 Equal Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Plan */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 shadow-xs space-y-2 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Current Plan</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {loadingSub ? "..." : subInfo?.plan?.displayName || "Free Plan"}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                ₹{subInfo?.plan?.priceMonthly || 0}/month
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border",
                subInfo?.isExpired || subInfo?.effectiveStatus === "renewal_due"
                  ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900"
              )}>
                {subInfo?.isExpired ? "Expired" : subInfo?.effectiveStatus === "renewal_due" ? "Renewal Due" : "Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: License Validity & Renewal */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 shadow-xs space-y-2 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">License Expiry</span>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              subInfo?.isRenewalDue
                ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            )}>
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono leading-tight">
              {loadingSub ? "..." : subInfo?.formattedExpiry || "N/A"}
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {loadingSub ? "Calculating..." : (
                subInfo?.isExpired ? (
                  <span className="text-red-600 dark:text-red-400 font-bold">Subscription Expired</span>
                ) : (
                  <span>{subInfo?.daysRemaining} days remaining</span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Invoices Count & Paid Total */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 shadow-xs space-y-2 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Invoices Generated</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {loadingInvoices ? "..." : `${invoices?.length || 0} Invoices`}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Latest: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{invoices?.[0]?.id || "None"}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Staff Seat Usage */}
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 shadow-xs space-y-2 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Employee Seats</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {loadingSub ? "..." : `${subInfo?.usage?.currentEmployees || 1} / ${subInfo?.usage?.maxEmployees || 50}`}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-[#635BFF] dark:bg-[#0BDBB9] h-full rounded-full transition-all duration-300"
                style={{ width: `${subInfo?.usage?.percentUsed || 10}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Workspace Organization Details Card */}
      {subInfo && (
        <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 font-extrabold text-lg shrink-0">
                {subInfo.companyName.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {subInfo.companyName}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>Workspace: <code className="font-semibold text-slate-800 dark:text-slate-200">{subInfo.slug}.payfix.in</code></span>
                  <span>•</span>
                  <span>Created: <strong className="text-slate-700 dark:text-slate-300">{subInfo.formattedCreated}</strong></span>
                  <span>•</span>
                  <span>Primary Admin: <strong className="text-slate-700 dark:text-slate-300">{subInfo.adminEmail}</strong></span>
                </div>
              </div>
            </div>

            {subInfo.isRenewalDue && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Renewal Due: Please contact your platform administrator for license extension.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Invoices & Renewal Receipts History Table */}
      <div className="bg-white dark:bg-[#121B22] border border-slate-200/90 dark:border-slate-800/80 rounded-[16px] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">Billing Invoices & Receipts</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Download official tax invoices and subscription renewal records</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #, plan, date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 h-[36px] border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50/50 dark:bg-[#0B131A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
            />
          </div>
        </div>

        {loadingInvoices ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#635BFF]" />
            <span className="text-xs font-semibold">Loading invoices...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-14 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No Invoices Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchTerm ? "No invoices matched your search query." : "Invoices will be recorded here when subscriptions renew or upgrade."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/70 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Billing Date</th>
                  <th className="py-3 px-4">Plan / Description</th>
                  <th className="py-3 px-4">Period Covered</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-[#635BFF] dark:text-[#0BDBB9]" />
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{inv.id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{inv.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {inv.planName || "Monthly Subscription"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {inv.periodStart && inv.periodEnd ? `${inv.periodStart} - ${inv.periodEnd}` : "Monthly Cycle"}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{inv.amount}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                        inv.status.toLowerCase() === "paid"
                          ? "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(inv)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-[#635BFF] hover:bg-[#5249e0] text-white rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Detailed Invoice Cum Renewal Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[#635BFF] dark:text-[#0BDBB9] flex items-center justify-center">
                  <Receipt className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Tax Invoice {selectedInvoice.id}
                  </h3>
                  <span className="text-[11px] text-slate-400">Subscription & Renewal Receipt</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            {/* Receipt Details Card */}
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-[#0B131A]/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Billed Organization:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{subInfo?.companyName || "Workspace Tenant"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Invoice Number:</span>
                <span className="font-mono font-bold text-[#635BFF]">{selectedInvoice.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Billing Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInvoice.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Subscription Plan:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedInvoice.planName || subInfo?.plan?.displayName || "Subscription Plan"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Billing Cycle:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">{selectedInvoice.billingCycle || "Monthly"}</span>
              </div>
              {selectedInvoice.periodStart && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Covered Period:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    {selectedInvoice.periodStart} to {selectedInvoice.periodEnd || "Active"}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Payment Mode:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{selectedInvoice.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Transaction ID:</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{selectedInvoice.transactionId}</span>
              </div>
              <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Total Paid:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg font-mono">
                  {selectedInvoice.amount}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Payment Status:</span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                  selectedInvoice.status?.toLowerCase() === "paid"
                    ? "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60"
                    : "bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60"
                )}>
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handlePrintReceipt(selectedInvoice)}
                className="h-10 px-4 bg-[#635BFF] hover:bg-[#5249e0] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>

              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="h-10 px-5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
