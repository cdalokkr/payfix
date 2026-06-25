import { AlertOctagon, HelpCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'License Expired - PayFix',
  description: 'Your license for this workspace has expired.',
};

export default function LicenseExpiredPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-100">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/80 border border-red-500/20 backdrop-blur-xl rounded-3xl p-8 shadow-[0_20px_50px_rgba(239,68,68,0.1)] text-center">
          {/* Warning Icon Container */}
          <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-6 animate-pulse">
            <AlertOctagon className="h-12 w-12 text-red-500" />
          </div>

          {/* Heading */}
          <h1 id="license-expired-title" className="text-3xl font-extrabold tracking-tight text-white mb-3">
            Licence Expired!
          </h1>
          
          {/* Warning Text */}
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Aapke workspace ki validity/expiry date samapt ho chuki hai. Aage ka access tabhi allowed hoga jab aapka licence renew hoga. Kripya admin account panel se renew karein ya support team se sampark karein.
          </p>

          {/* Info Box */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-8 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Status</span>
              <span className="text-red-400 font-bold uppercase tracking-wider">Blocked</span>
            </div>
            <div className="h-px bg-slate-800" />
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Reason</span>
              <span className="text-slate-300">Subscription Validity Period Ended</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <a
              id="contact-support-btn"
              href="mailto:support@saaskit.in?subject=PayFix License Renewal Request"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-xl transition-all duration-300 shadow-[0_4px_20px_rgba(220,38,38,0.2)]"
            >
              <HelpCircle className="h-4 w-4" />
              Contact Support
            </a>
            
            <Link
              id="back-home-btn"
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all duration-300 border border-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-slate-600 text-xs">
          &copy; {new Date().getFullYear()} PayFix SaaS Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
