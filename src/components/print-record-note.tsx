"use client";

import { useEffect, useState } from "react";
import { printedNote } from "@/lib/records";

/** Shows only on paper (or a saved PDF): who printed it is responsible for the copy. */
export function PrintRecordNote() {
  const [date, setDate] = useState("");
  useEffect(() => {
    const stamp = () => setDate(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
    stamp();
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);
  return <p data-print-note className="mt-10 hidden border-t border-border pt-3 text-xs print:block">{printedNote(date || "this date")}</p>;
}
