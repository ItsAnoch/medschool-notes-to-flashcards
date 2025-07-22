"use client";

import { useState, FormEvent } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return alert("Please choose a PDF first");

    try {
      setBusy(true);

      // Build multipart/form‑data
      const data = new FormData();
      data.append("file", file, file.name);

      // POST to your API
      const res = await fetch("/api/flashcards", {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server responded ${res.status}: ${errorText}`);
      }

      // Response should be CSV
      const blob = await res.blob();               // `text/csv` blob
      const url = URL.createObjectURL(blob);

      // Create an invisible <a> and click it
      const a = document.createElement("a");
      a.href = url;
      a.download = "flashcards.csv";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Release the blob URL once the download has started
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Something went wrong generating flash cards. Check console.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-8 space-y-4">
      <form onSubmit={handleSubmit} className="space-x-2">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={!file || busy}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {busy ? "Generating…" : "Submit"}
        </button>
      </form>
      {file && (
        <p className="text-sm text-gray-600">
          Selected file: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}
    </main>
  );
}
