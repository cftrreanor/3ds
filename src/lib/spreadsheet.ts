/**
 * Reads a spreadsheet the host picked, in their browser: a .csv (or .tsv)
 * file, or the first sheet of an Excel .xlsx file (Google Sheets and Numbers
 * save both). Returns its rows as text, as they'd appear on screen.
 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls") || name.endsWith(".numbers")) {
    throw new Error("Please save the spreadsheet as an Excel .xlsx file or a .csv file first, then pick that.");
  }
  if (name.endsWith(".xlsx")) return readXlsx(await file.arrayBuffer());
  return parseCsv(await file.text());
}

/** Comma-, tab- or semicolon-separated text, with "quoted, values" and "" for a quote. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = [",", "\t", ";"].reduce((best, d) => (count(firstLine, d) > count(firstLine, best) ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return tidy(rows);
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/** Trim every cell and drop empty rows. */
function tidy(rows: string[][]) {
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

// ---------------------------------------------------------------------------
// .xlsx: a zip of XML files. Just enough of the format for a plain table.
// ---------------------------------------------------------------------------

async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const files = unzipIndex(buffer);
  const read = async (path: string) => {
    const entry = files.get(path.replace(/^\//, ""));
    return entry ? xml(await inflate(buffer, entry)) : null;
  };

  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (!workbook) throw new Error("That doesn't look like an Excel file. Try saving it as .xlsx or .csv again.");
  // The first sheet, wherever the workbook keeps it.
  const firstSheet = byTag(workbook, "sheet")[0];
  const relId = firstSheet?.getAttribute("r:id") ?? firstSheet?.getAttributeNS(REL_NS, "id");
  const target = rels && relId ? byTag(rels, "Relationship").find((r) => r.getAttribute("Id") === relId)?.getAttribute("Target") : null;
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("We couldn't find a sheet in that file.");

  const strings = await read("xl/sharedStrings.xml");
  const shared = strings
    ? byTag(strings, "si").map((si) =>
        byTag(si, "t")
          .filter((t) => t.parentElement?.localName !== "rPh")
          .map((t) => t.textContent ?? "")
          .join(""),
      )
    : [];
  const dateStyles = readDateStyles(await read("xl/styles.xml"));

  const rows: string[][] = [];
  for (const r of byTag(sheet, "row")) {
    const row: string[] = [];
    let next = 0;
    for (const c of byTag(r, "c")) {
      const ref = c.getAttribute("r");
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = c.getAttribute("t");
      const v = byTag(c, "v")[0]?.textContent ?? "";
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = byTag(c, "t").map((t) => t.textContent ?? "").join("");
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else if (type === "str" || type === "e") value = v;
      else if (v !== "" && dateStyles.has(Number(c.getAttribute("s") ?? -1))) value = excelDate(Number(v));
      else value = v === "" ? "" : formatNumber(v);
      row[col] = value;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return tidy(rows);
}

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function xml(text: string) {
  return new DOMParser().parseFromString(text, "application/xml");
}

/** Elements by local name, whatever namespace prefix the file uses. */
function byTag(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", name));
}

/** "C12" -> 2 */
function columnIndex(ref: string) {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 5125550100 stays as typed; 2.5000000000000001 -> 2.5. */
function formatNumber(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? String(Number(n.toPrecision(15))) : v;
}

/** Cell styles that show a number as a date or time. */
function readDateStyles(styles: Document | null) {
  const found = new Set<number>();
  if (!styles) return found;
  const custom = new Map(byTag(styles, "numFmt").map((f) => [Number(f.getAttribute("numFmtId")), f.getAttribute("formatCode") ?? ""]));
  const isDate = (id: number) =>
    (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dmyhs]/i.test((custom.get(id) ?? "").replace(/\[[^\]]*\]|"[^"]*"/g, ""));
  const xfs = byTag(styles, "cellXfs")[0];
  if (!xfs) return found;
  Array.from(xfs.children).forEach((xf, i) => {
    if (isDate(Number(xf.getAttribute("numFmtId") ?? 0))) found.add(i);
  });
  return found;
}

/** Excel's day count -> "2026-10-17", "9:00 AM" or "2026-10-17 9:00 AM". */
function excelDate(serial: number) {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  const date = d.toISOString().slice(0, 10);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const h = Math.floor(minutes / 60);
  const time = `${h % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  if (serial < 1) return time;
  return minutes ? `${date} ${time}` : date;
}

type ZipEntry = { offset: number; size: number; method: number };

/** Where each file sits in the zip, from its central directory. */
function unzipIndex(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("That doesn't look like an Excel file. Try saving it as .xlsx or .csv again.");
  const entries = new Map<string, ZipEntry>();
  const total = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let i = 0; i < total; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLength));
    entries.set(name, { offset, size, method });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer);
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const data = new Uint8Array(buffer, start, entry.size);
  if (entry.method === 0) return new TextDecoder().decode(data);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}
