import { GoogleGenAI, Type } from "@google/genai";
import * as z from "zod";

// ------------------------------
// Schema & validator
// ------------------------------
export const FlashCardSchema = z.object({
  question: z.string(),
  answer: z.string(),
});
const FlashCardsArray = z.object({ flashcard: z.array(FlashCardSchema) });

// Gemini structured‑output schema (JSON Schema draft‑07 style)
const responseSchema = {
      type: Type.OBJECT,
      required: ["flashcard"],
      properties: {
        flashcard: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["question", "answer"],
            properties: {
              question: {
                type: Type.STRING,
              },
              answer: {
                type: Type.STRING,
              },
            },
          },
        },
      },
    } as const;

/**
 * Calls the Gemini 2.5 Flash model to generate flash cards for a PDF.
 *
 * @param pdf – Raw PDF bytes.
 * @returns Parsed & validated flash‑card objects.
 */
export async function generateFlashCardsFromPDF(pdf: Buffer) {
  // Initialise Gemini client (Developer API key is picked up from env)
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  /**
   * System instruction – kept concise because we rely mainly on the PDF context.
   * Gemini already respects `responseSchema`, so no need to restate the JSON contract here.
   */
  const systemPrompt = `You are an expert study‑guide assistant. Create comprehensive, in‑depth flash cards that cover **all** concepts in the attached PDF. Do not omit any sections.`;

  // Encode the PDF so we can send it inline (<20 MB limit)
  const base64pdf = pdf.toString("base64");

  // Assemble the multi‑part, multi‑role prompt
  const contents = [
    {
      role: "user" as const,
      parts: [{ text: systemPrompt }],
    },
    {
      role: "user" as const,
      parts: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64pdf,
          },
        },
      ],
    },
  ];
  
//   const contents = [
//     {
//       role: 'user',
//       parts: [
//         {
//           text: `hello`,
//         },
//       ],
//     },
//     {
//       role: 'model',
//       parts: [
//         {
//           text: `{
//   "flashcard": [
//     {
//       "answer": "Hello is a common greeting in English.",
//       "question": "What is hello?"
//     }
//   ]
// }`,
//         },


  // Fire the request – Gemini returns JSON thanks to `responseSchema`
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // or the auto‑updated alias `gemini-2.5-flash`.
    contents,
    config: {
        responseSchema,
        responseMimeType: "application/json",
    }
  });

  const jsonText = response.text; // Structured JSON string
  if (!jsonText) throw new Error("LLM response was empty");

  console.log(jsonText);

  // Validate & parse with Zod
  return FlashCardsArray.parse(JSON.parse(jsonText)).flashcard;
}