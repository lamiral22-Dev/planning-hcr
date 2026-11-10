import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">
          🔍
        </div>

        <h1 className="text-3xl font-black text-gray-900 tracking-tight">404</h1>
        <h2 className="text-base font-bold text-gray-800">Page introuvable</h2>
        <p className="text-xs text-gray-500 max-w-xs">
          La page demandée n&apos;existe pas ou a été déplacée. Veuillez vérifier l&apos;adresse ou revenir à l&apos;espace de gestion.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 w-full mt-2">
          <Link
            href="/salarie/planning"
            className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors"
          >
            Planning Salarié
          </Link>
          <Link
            href="/manager/planning"
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-xs transition-colors"
          >
            Planning Manager
          </Link>
        </div>
      </div>
    </div>
  );
}
