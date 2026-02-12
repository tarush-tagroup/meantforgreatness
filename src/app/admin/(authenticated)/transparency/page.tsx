"use client";

import { useState, useEffect } from "react";

interface Report {
  id: string;
  title: string;
  quarter: number;
  year: number;
  totalClasses: number;
  totalStudents: number;
  totalTeachers: number;
  orphanageCount: number;
  content: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export default function TransparencyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Generate form state
  const [showGenerate, setShowGenerate] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const [genQuarter, setGenQuarter] = useState(currentQuarter);
  const [genYear, setGenYear] = useState(currentYear);
  const [generating, setGenerating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/transparency-reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/transparency-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter: genQuarter, year: genYear }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate report");
      }
      setShowGenerate(false);
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleEdit(report: Report) {
    setEditingId(report.id);
    setEditTitle(report.title);
    setEditContent(report.content || "");
  }

  async function handleSave() {
    if (!editingId) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/transparency-reports/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setEditingId(null);
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/admin/transparency-reports/${id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish");
      }
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    }
  }

  if (editingId) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => setEditingId(null)}
            className="text-sm text-warmgray-500 hover:text-warmgray-700"
          >
            &larr; Back to reports
          </button>
          <h1 className="mt-2 text-2xl font-bold text-warmgray-900">Edit Report</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="max-w-3xl space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-warmgray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-warmgray-700 mb-1">
              Content (Markdown)
            </label>
            <textarea
              id="content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={20}
              className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900 font-mono resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-warmgray-200 px-4 py-2 text-sm font-medium text-warmgray-600 hover:bg-warmgray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-warmgray-900">
            Transparency Reports
          </h1>
          <p className="mt-1 text-sm text-warmgray-500">
            {reports.length} report{reports.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          Generate Report
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Generate Form */}
      {showGenerate && (
        <div className="mb-6 rounded-lg border border-warmgray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-warmgray-900 mb-3">
            Generate New Report
          </h2>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-xs text-warmgray-500 mb-1">Quarter</label>
              <select
                value={genQuarter}
                onChange={(e) => setGenQuarter(Number(e.target.value))}
                className="rounded-lg border border-warmgray-200 px-3 py-2 text-sm"
              >
                <option value={1}>Q1 (Jan-Mar)</option>
                <option value={2}>Q2 (Apr-Jun)</option>
                <option value={3}>Q3 (Jul-Sep)</option>
                <option value={4}>Q4 (Oct-Dec)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-warmgray-500 mb-1">Year</label>
              <input
                type="number"
                value={genYear}
                onChange={(e) => setGenYear(Number(e.target.value))}
                min={2020}
                max={2030}
                className="rounded-lg border border-warmgray-200 px-3 py-2 text-sm w-24"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
          <p className="mt-2 text-xs text-warmgray-400">
            This will auto-generate a report from class log data for the selected quarter.
          </p>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">Loading...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">No transparency reports yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-lg border border-warmgray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-warmgray-900 truncate">
                      {report.title}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        report.published
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                      }`}
                    >
                      {report.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="text-sm text-warmgray-500 mt-1">
                    Q{report.quarter} {report.year}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-warmgray-400">Classes</p>
                  <p className="text-sm font-medium text-warmgray-900">{report.totalClasses}</p>
                </div>
                <div>
                  <p className="text-xs text-warmgray-400">Students</p>
                  <p className="text-sm font-medium text-warmgray-900">{report.totalStudents}</p>
                </div>
                <div>
                  <p className="text-xs text-warmgray-400">Teachers</p>
                  <p className="text-sm font-medium text-warmgray-900">{report.totalTeachers}</p>
                </div>
                <div>
                  <p className="text-xs text-warmgray-400">Orphanages</p>
                  <p className="text-sm font-medium text-warmgray-900">{report.orphanageCount}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-warmgray-100 flex items-center gap-4">
                {!report.published && (
                  <>
                    <button
                      onClick={() => handleEdit(report)}
                      className="text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handlePublish(report.id)}
                      className="text-sm font-medium text-amber-600 hover:text-amber-700"
                    >
                      Publish
                    </button>
                  </>
                )}
                {report.published && report.publishedAt && (
                  <p className="text-xs text-warmgray-400">
                    Published {new Date(report.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
