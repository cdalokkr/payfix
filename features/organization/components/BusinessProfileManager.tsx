"use client"

import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { 
  Building2, 
  Upload, 
  Trash2, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Settings2, 
  Globe, 
  Phone, 
  Mail, 
  MapPin, 
  Receipt,
  Loader2,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TenantLogo } from '@/components/brand/TenantLogo';
import { validateLogoFile, uploadTenantLogo } from '@/lib/utils/tenant-logo-upload';
import { generatePDF } from '@/lib/report-utils';

export function BusinessProfileManager() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiDocInputRef = useRef<HTMLInputElement>(null);

  // Load current branding and business profile
  const { data: orgData, isLoading } = trpc.organization.getBranding.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  // Logo state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);

  // AI Document scanning state
  const [isScanningAI, setIsScanningAI] = useState(false);

  // Business Form State
  const [formData, setFormData] = useState({
    appName: '',
    tagline: '',
    companyLegalName: '',
    companyAddress: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    contactEmail: '',
    contactPhone: '',
    website: '',
    taxId: '',
    reportLogoHeight: 24,
    reportLogoAlignment: 'left' as 'left' | 'center' | 'right',
    payslipNotes: '',
  });

  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);

  // Sync state when data loads
  useEffect(() => {
    if (orgData?.branding) {
      const b = orgData.branding;
      setFormData({
        appName: b.appName || orgData.companyName || '',
        tagline: b.tagline || '',
        companyLegalName: b.companyLegalName || orgData.companyName || '',
        companyAddress: b.companyAddress || '',
        city: b.city || '',
        state: b.state || '',
        pincode: b.pincode || '',
        country: b.country || 'India',
        contactEmail: b.contactEmail || orgData.adminEmail || '',
        contactPhone: b.contactPhone || '',
        website: b.website || '',
        taxId: b.taxId || '',
        reportLogoHeight: b.reportLogoHeight || 24,
        reportLogoAlignment: b.reportLogoAlignment || 'left',
        payslipNotes: b.payslipNotes || '',
      });
      setPreviewLogoUrl(b.logoUrl || null);
    }
  }, [orgData]);

  // Mutations
  const updateLogoMutation = trpc.organization.updateLogo.useMutation({
    onSuccess: (data) => {
      setPreviewLogoUrl(data.logoUrl);
      utils.organization.getBranding.invalidate();
      toast.success('Business logo updated successfully! Changes reflect across web app, PWA, and reports.');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update logo');
    },
  });

  const deleteLogoMutation = trpc.organization.deleteLogo.useMutation({
    onSuccess: () => {
      setPreviewLogoUrl(null);
      utils.organization.getBranding.invalidate();
      toast.success('Logo removed. The default organization mark will be used.');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove logo');
    },
  });

  const updateDetailsMutation = trpc.organization.updateBusinessDetails.useMutation({
    onSuccess: () => {
      utils.organization.getBranding.invalidate();
      toast.success('Business details & report configuration saved successfully!');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save business details');
    },
  });

  const aiExtractMutation = trpc.organization.extractBusinessDetailsWithAI.useMutation({
    onSuccess: (res) => {
      const d = res.details;
      setFormData((prev) => ({
        ...prev,
        companyLegalName: d.companyLegalName || prev.companyLegalName,
        tagline: d.tagline || prev.tagline,
        companyAddress: d.companyAddress || prev.companyAddress,
        city: d.city || prev.city,
        state: d.state || prev.state,
        pincode: d.pincode || prev.pincode,
        country: d.country || prev.country,
        contactEmail: d.contactEmail || prev.contactEmail,
        contactPhone: d.contactPhone || prev.contactPhone,
        website: d.website || prev.website,
        taxId: d.taxId || prev.taxId,
      }));
      toast.success('✨ Business information extracted and filled via Gemini AI!');
    },
    onError: (err) => {
      toast.error(err.message || 'AI document scanning failed');
    },
  });

  // Handle Logo Upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid logo file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploadingLogo(true);
      const tenantId = orgData?.tenantId;
      if (!tenantId) {
        throw new Error('Tenant identification is missing');
      }

      // Upload via secure server endpoint (handles storage upload, db record, and cache clearing)
      const publicUrl = await uploadTenantLogo(file, tenantId);

      setPreviewLogoUrl(publicUrl);
      utils.organization.getBranding.invalidate();
      toast.success('Business logo updated successfully! Changes reflect across web app, PWA, and reports.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Logo Delete
  const handleConfirmDelete = async () => {
    try {
      setIsDeletingLogo(true);
      await deleteLogoMutation.mutateAsync();
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete logo');
    } finally {
      setIsDeletingLogo(false);
    }
  };

  // Handle Save Business Details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingDetails(true);
      await updateDetailsMutation.mutateAsync(formData);
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Handle AI Autofill Document Upload
  const handleAiDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanningAI(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          await aiExtractMutation.mutateAsync({
            base64Image: base64,
            mimeType: file.type || 'image/jpeg',
          });
        } catch (err) {
          // Handled in mutation onError
        } finally {
          setIsScanningAI(false);
          if (aiDocInputRef.current) aiDocInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read document');
        setIsScanningAI(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message || 'Failed to process document');
      setIsScanningAI(false);
    }
  };

  // Generate Sample PDF Preview with Current Settings
  const handlePreviewPdf = async () => {
    try {
      setIsPreviewingPdf(true);
      const sampleHeaders = ['#', 'Employee Name', 'Department', 'Designation', 'Status'];
      const sampleRows = [
        ['1', 'Rahul Sharma', 'Engineering', 'Senior Developer', 'Active'],
        ['2', 'Priya Patel', 'Finance', 'Accounts Officer', 'Active'],
        ['3', 'Amit Kumar', 'Operations', 'Field Supervisor', 'Active'],
      ];

      await generatePDF(
        'SAMPLE OFFICIAL REPORT',
        sampleHeaders,
        sampleRows,
        `${(formData.companyLegalName || 'Company').replace(/\s+/g, '_')}_Sample_Report.pdf`,
        {
          appName: formData.appName,
          companyLegalName: formData.companyLegalName,
          companyAddress: formData.companyAddress,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          country: formData.country,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          website: formData.website,
          taxId: formData.taxId,
          logoUrl: previewLogoUrl,
          reportLogoHeight: formData.reportLogoHeight,
          reportLogoAlignment: formData.reportLogoAlignment,
          payslipNotes: formData.payslipNotes,
        }
      );
      toast.success('Sample branded report downloaded!');
    } catch (err) {
      toast.error('Failed to generate preview PDF');
    } finally {
      setIsPreviewingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading workspace branding & business details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner & AI Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-primary/5 to-transparent border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {orgData?.companyName || 'Business Profile & Branding'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage your company logo, official legal details, and report letterhead configurations.
            </p>
          </div>
        </div>

        {/* AI Autofill Trigger */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={aiDocInputRef}
            onChange={handleAiDocUpload}
            accept="image/*"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => aiDocInputRef.current?.click()}
            disabled={isScanningAI}
            className="gap-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-xs"
          >
            {isScanningAI ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            )}
            {isScanningAI ? 'Scanning Document...' : 'AI Autofill from Card/GST'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreviewPdf}
            disabled={isPreviewingPdf}
            className="gap-2"
          >
            {isPreviewingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-emerald-600" />
            )}
            Preview Report PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logo" className="space-y-6">
        <TabsList className="bg-muted/70 p-1 rounded-xl border border-border h-auto gap-1">
          <TabsTrigger value="logo" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card">
            <Building2 className="w-4 h-4 mr-2 text-indigo-600" />
            Business Logo
          </TabsTrigger>
          <TabsTrigger value="details" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card">
            <Receipt className="w-4 h-4 mr-2 text-blue-600" />
            Legal & Tax Details
          </TabsTrigger>
          <TabsTrigger value="reports" className="py-2.5 px-4 font-semibold data-[state=active]:bg-card">
            <FileText className="w-4 h-4 mr-2 text-emerald-600" />
            Report & Payslip Styling
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LOGO MANAGEMENT */}
        <TabsContent value="logo" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload & Actions Card */}
            <Card className="lg:col-span-2 shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Organization Logo</span>
                  {previewLogoUrl && (
                    <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Custom Logo Active
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Upload your brand emblem. This logo automatically appears on the web navigation, PWA home screen, all exported attendance reports, and official employee payslips.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                />

                {/* Upload Drag & Drop Area */}
                <div
                  onClick={() => !isUploadingLogo && fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40"
                >
                  {isUploadingLogo ? (
                    <div className="flex flex-col items-center space-y-3">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      <p className="text-sm font-medium">Uploading & optimizing logo...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-3">
                      <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Click to upload or drag and drop your logo
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPEG, WebP, or SVG (Max 2MB). Transparent background recommended.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Logo Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-muted-foreground">
                    Recommended dimensions: <span className="font-semibold text-foreground">512 × 512 px</span> (square) or <span className="font-semibold text-foreground">600 × 200 px</span> (horizontal).
                  </div>

                  <div className="flex items-center gap-2">
                    {previewLogoUrl && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        disabled={isDeletingLogo || isUploadingLogo}
                        className="gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove Logo
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      {previewLogoUrl ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Contextual Preview */}
            <Card className="shadow-xs bg-muted/10">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Live Context Previews
                </CardTitle>
                <CardDescription className="text-xs">
                  How your logo appears in various parts of the application:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 1. Sidebar Preview */}
                <div className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Desktop Sidebar
                  </div>
                  <div className="flex items-center gap-2.5">
                    <TenantLogo size="md" logoUrl={previewLogoUrl} appName={formData.appName} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate text-foreground">{formData.appName || 'Company'}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{formData.tagline || 'Workspace'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Topbar / Mobile Header Preview */}
                <div className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Mobile / PWA Header
                  </div>
                  <div className="flex items-center gap-2">
                    <TenantLogo size="sm" logoUrl={previewLogoUrl} appName={formData.appName} />
                    <span className="text-xs font-semibold text-foreground truncate">{formData.appName || 'Company'}</span>
                  </div>
                </div>

                {/* 3. Document Letterhead Preview */}
                <div className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Payslip & Report Letterhead
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px]">
                    <div className={`flex items-center gap-2 ${formData.reportLogoAlignment === 'center' ? 'justify-center flex-col text-center' : formData.reportLogoAlignment === 'right' ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                      <TenantLogo size="sm" logoUrl={previewLogoUrl} appName={formData.appName} />
                      <div className={formData.reportLogoAlignment === 'center' ? 'text-center' : ''}>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{formData.companyLegalName || formData.appName || 'Acme Corp'}</p>
                        <p className="text-[9px] text-slate-500">{formData.taxId ? `GSTIN: ${formData.taxId}` : 'Tax ID / Address'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: LEGAL & TAX DETAILS */}
        <TabsContent value="details" className="focus-visible:outline-none">
          <form onSubmit={handleSaveDetails}>
            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg">Company Details & Address</CardTitle>
                <CardDescription>
                  These official business details will appear directly on generated payslips, tax statements, and PDF reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">App / Brand Display Name</Label>
                    <Input
                      id="appName"
                      value={formData.appName}
                      onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                      placeholder="e.g. Acme Innovations"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyLegalName">Company Legal / Registered Name</Label>
                    <Input
                      id="companyLegalName"
                      value={formData.companyLegalName}
                      onChange={(e) => setFormData({ ...formData, companyLegalName: e.target.value })}
                      placeholder="e.g. Acme Innovations Private Limited"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline / Motto</Label>
                    <Input
                      id="tagline"
                      value={formData.tagline}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      placeholder="e.g. Innovating the Future"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxId">GSTIN / Tax ID / Corporate Registration No.</Label>
                    <Input
                      id="taxId"
                      value={formData.taxId}
                      onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                      placeholder="e.g. 07AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Registered Office Address</Label>
                  <Textarea
                    id="companyAddress"
                    rows={2}
                    value={formData.companyAddress}
                    onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                    placeholder="e.g. Plot No. 42, Cyber City, Phase 2"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Gurugram"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g. Haryana"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pincode">PIN / Postal Code</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="e.g. 122002"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="e.g. India"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Official Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="contact@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Official Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://company.com"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 border-t border-border/50 py-4">
                <Button type="submit" disabled={isSavingDetails}>
                  {isSavingDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Business Details'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        {/* TAB 3: REPORT & PAYSLIP STYLING */}
        <TabsContent value="reports" className="focus-visible:outline-none">
          <form onSubmit={handleSaveDetails}>
            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg">Report & Payslip Customization</CardTitle>
                <CardDescription>
                  Configure how your logo and company details are rendered in PDF downloads and print formats.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Height Slider */}
                <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">Report Logo Height</Label>
                      <p className="text-xs text-muted-foreground">Adjust the logo scaling in millimeters for PDF documents.</p>
                    </div>
                    <span className="text-sm font-mono font-bold px-2.5 py-1 rounded-md bg-card border border-border">
                      {formData.reportLogoHeight} mm
                    </span>
                  </div>
                  <Slider
                    min={14}
                    max={45}
                    step={1}
                    value={[formData.reportLogoHeight]}
                    onValueChange={(val) => setFormData({ ...formData, reportLogoHeight: val[0] })}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Compact (14mm)</span>
                    <span>Standard (24mm)</span>
                    <span>Large (45mm)</span>
                  </div>
                </div>

                {/* Logo Alignment */}
                <div className="space-y-2">
                  <Label htmlFor="reportLogoAlignment">Header Logo Alignment</Label>
                  <Select
                    value={formData.reportLogoAlignment}
                    onValueChange={(val: any) => setFormData({ ...formData, reportLogoAlignment: val })}
                  >
                    <SelectTrigger id="reportLogoAlignment">
                      <SelectValue placeholder="Select alignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left Aligned (Modern Letterhead)</SelectItem>
                      <SelectItem value="center">Centered (Formal Corporate Header)</SelectItem>
                      <SelectItem value="right">Right Aligned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payslip Notes / Disclaimer */}
                <div className="space-y-2">
                  <Label htmlFor="payslipNotes">Payslip Footer Disclaimer / Notes</Label>
                  <Textarea
                    id="payslipNotes"
                    rows={2}
                    value={formData.payslipNotes}
                    onChange={(e) => setFormData({ ...formData, payslipNotes: e.target.value })}
                    placeholder="e.g. This is a computer generated payslip and does not require a signature."
                  />
                  <p className="text-xs text-muted-foreground">
                    This note will be printed at the bottom of all downloaded employee salary slips.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-border/50 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewPdf}
                  disabled={isPreviewingPdf}
                  className="gap-2"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Download Test PDF
                </Button>
                <Button type="submit" disabled={isSavingDetails}>
                  {isSavingDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Report Styling'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>

      {/* Delete Logo Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Business Logo?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your custom business logo? The application interface, PWA, and reports will revert to the default PayFix organization mark.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLogo}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeletingLogo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingLogo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Yes, Remove Logo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BusinessProfileManager;
