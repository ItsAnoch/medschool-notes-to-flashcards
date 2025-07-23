"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";

/**
 * Zod schema – we use `z.custom` instead of `z.instanceof(File | FileList)`
 * so the validator only touches the `File` constructor **in the browser**.
 * This avoids `ReferenceError: FileList is not defined` during server‑side bundling.
 */
const formSchema = z.object({
  file: z
    .custom<File>(
      (v) => v instanceof File && v.type === "application/pdf" && v.size > 0,
      "Please choose a PDF file",
    )
    .nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { file: null },
  });

  const selectedFile = watch("file");

  async function onSubmit({ file }: FormValues) {
    if (!file) return; // type‑guard: already validated but TS needs it

    const toastId = toast.loading("Generating flashcards…");
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);

      const res = await fetch("/api/flashcards", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flashcards.csv";
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Flashcards downloaded!", { id: toastId });
      reset();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message ?? "Something went wrong"}`, { id: toastId });
    }
  }

  return (
    <>
      {/* Sonner toaster mounted once */}
      <Toaster richColors position="top-right" />

      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-semibold">
              Ahrani's Beautiful Notes&nbsp;AI
            </CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="grid gap-1">
                <Label htmlFor="file">Choose a PDF</Label>
                <Input
                  id="file"
                  type="file"
                  accept="application/pdf"
                  {...register("file", { required: true })}
                />
                {errors.file && (
                  <p className="text-sm text-red-500 font-medium">
                    {errors.file.message}
                  </p>
                )}
              </div>

              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: <strong>{selectedFile.name}</strong> ( {(selectedFile.size / 1024 / 1024).toFixed(2)} MB )
                </p>
              )}
            </CardContent>

            <CardFooter className="justify-end">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Generating…" : "Generate Flashcards"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </>
  );
}
