import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { generateFlashCardsFromPDF } from "@/app/actions"; // make sure this path is correct

/**
 * POST /api/flashcards
 *
 * Body: multipart/form-data with a **file** field that contains a single PDF.
 *
 * ‑ If the PDF has **≤ 500** pages, it is processed as‑is.
 * ‑ If the PDF has **> 500** pages, it is partitioned into **100‑page** chunks
 *   and each chunk is processed individually.
 *
 * The flash‑card arrays from all chunks are concatenated and returned as a
 * CSV, where **column 1** = question and **column 2** = answer.
 *
 * The response headers instruct browsers to download the CSV as
 * `flashcards.csv`.
 */
export async function POST(req: NextRequest) {
  // ────────────────────────────────────────────────────────────────────────────
  // 1) Parse multipart/form‑data and pull out the PDF file
  // ────────────────────────────────────────────────────────────────────────────
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Missing PDF in form‑data under field 'file'." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  // ────────────────────────────────────────────────────────────────────────────
  // 2) Load PDF and decide whether to split
  // ────────────────────────────────────────────────────────────────────────────
  const masterDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = masterDoc.getPageCount();

  // Helper to split the PDF into 100‑page buffers
  async function splitPdf(doc: PDFDocument, chunkSize = 100): Promise<Buffer[]> {
    const chunks: Buffer[] = [];
    for (let start = 0; start < totalPages; start += chunkSize) {
      const end = Math.min(start + chunkSize, totalPages);
      const newDoc = await PDFDocument.create();
      const pages = await newDoc.copyPages(doc, Array.from({ length: end - start }, (_, i) => i + start));
      pages.forEach((p) => newDoc.addPage(p));
      const chunkBytes = await newDoc.save();
      chunks.push(Buffer.from(chunkBytes));
    }
    return chunks;
  }

  const pdfBuffers: Buffer[] = totalPages > 500 ? await splitPdf(masterDoc) : [pdfBuffer];

  // ────────────────────────────────────────────────────────────────────────────
  // 3) Generate flash‑cards for each buffer sequentially (to stay API‑safe)
  //    You can parallelise with Promise.all but beware of rate‑limits.
  // ────────────────────────────────────────────────────────────────────────────
  const allCards: { question: string; answer: string }[] = [];
  for (const buf of pdfBuffers) {
    const cards = await generateFlashCardsFromPDF(buf);
    allCards.push(...cards);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4) Convert to CSV  (questions,answers) – no header row by default.
  //    We escape double‑quotes and wrap each field in quotes to be safe.
  // ────────────────────────────────────────────────────────────────────────────
  const escape = (s: string) => s.replace(/"/g, '""');
  const csv = allCards.map(({ question, answer }) => `"${escape(question)}","${escape(answer)}"`).join("\n");

  // Optional: add a header row – uncomment if desired
  // const header = 'question,answer\n';
  // const csvWithHeader = header + csv;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=flashcards.csv",
    },
  });
}