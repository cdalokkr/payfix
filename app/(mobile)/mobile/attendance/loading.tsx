export default function MobileAttendanceLoading() {
    return (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md flex flex-col items-center justify-center space-y-5 text-center">
                <div className="w-52 h-64 rounded-[999px] border-2 border-sky-500/30 bg-slate-900/60 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin" />
                </div>
                <div className="space-y-1.5">
                    <p className="text-sm font-bold text-white tracking-tight">Preparing Attendance Camera…</p>
                    <p className="text-[11px] font-medium text-slate-400">Connecting location &amp; biometric verifier</p>
                </div>
            </div>
        </div>
    )
}
