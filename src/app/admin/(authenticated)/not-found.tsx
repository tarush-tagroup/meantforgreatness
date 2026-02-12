import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-warmgray-100 flex items-center justify-center mb-4">
        <span className="text-2xl font-bold text-warmgray-400">?</span>
      </div>
      <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
        Page Not Found
      </h2>
      <p className="text-sm text-warmgray-500 mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/admin"
        className="rounded-lg bg-warmgray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-warmgray-800 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
