export function getTheme(isLight: boolean) {
    return {
        bg: isLight ? "bg-slate-50" : "bg-slate-950",
        cardCls: isLight ? "bg-white rounded-2xl shadow-sm border border-slate-200" : "bg-slate-900 rounded-2xl shadow-sm border border-slate-800",
        textPrimary: isLight ? "text-slate-900" : "text-white",
        textMuted: isLight ? "text-slate-500" : "text-slate-400",
        surfaceCls: isLight ? "bg-slate-100" : "bg-slate-800/50",
        borderCls: isLight ? "border-slate-300" : "border-slate-700",
        inputCls: isLight
            ? "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
            : "bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500",
        tabBg: isLight ? "bg-slate-200" : "bg-slate-900 border border-slate-800",
        tabActive: isLight ? "bg-white text-slate-900 shadow-sm" : "bg-slate-800 text-white shadow-sm border border-slate-700",
        tabInactive: isLight ? "text-slate-500 hover:text-slate-700" : "text-slate-400 hover:text-slate-200",
        btnSurface: isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900" : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50",
        homeBtn: isLight ? "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200 shadow-sm" : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700",
        ringOffsetCls: isLight ? "ring-offset-white" : "ring-offset-slate-900",
    };
}
