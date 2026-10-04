import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

// Band registration fields, shared by the director's form and the host's edits.

const count = (label: string, max = 1000) =>
  z.coerce.number({ message: `${label}: enter a number` }).int(`${label}: whole numbers only`).min(0, `${label} can't be negative`).max(max, `${label} looks too high`);

export const bandSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is required").max(150),
  bandName: z.string().trim().min(2, "Band name is required").max(150),
  classification: z.string().trim().min(1, "Pick a classification"),
  schoolAddress: z.string().trim().min(5, "School address is required").max(300),
  contactEmail: z.string().trim().toLowerCase().email("Band contact email isn't valid"),
  headDirectorName: z.string().trim().min(2, "Head director's name is required").max(150),
  headDirectorEmail: z.string().trim().toLowerCase().email("Head director's email isn't valid"),
  headDirectorPhone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) ctx.addIssue({ code: "custom", message: "Head director's mobile: enter a 10-digit number" });
      return p ?? "";
    }),
  assistantDirectors: z
    .string()
    .max(1000)
    .transform((v) =>
      v
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  studentCount: count("Students", 1000),
  chaperoneCount: count("Chaperones", 500),
  busCount: count("Buses", 50),
  boxTruckCount: count("Box trucks", 20),
  truckTrailerCount: count("Truck/trailer combos", 20),
  semiTruckCount: count("Semi trucks", 20),
  contestDayConflicts: z.string().trim().max(2000).transform((v) => v || null),
  specialNeeds: z.string().trim().max(2000).transform((v) => v || null),
});

export type BandInput = z.infer<typeof bandSchema>;

export function parseBand(formData: FormData) {
  return bandSchema.safeParse({
    schoolName: formData.get("schoolName") ?? "",
    bandName: formData.get("bandName") ?? "",
    classification: formData.get("classification") ?? "",
    schoolAddress: formData.get("schoolAddress") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    headDirectorName: formData.get("headDirectorName") ?? "",
    headDirectorEmail: formData.get("headDirectorEmail") ?? "",
    headDirectorPhone: formData.get("headDirectorPhone") ?? "",
    assistantDirectors: formData.get("assistantDirectors") ?? "",
    studentCount: formData.get("studentCount") ?? "",
    chaperoneCount: formData.get("chaperoneCount") ?? "",
    busCount: formData.get("busCount") || 0,
    boxTruckCount: formData.get("boxTruckCount") || 0,
    truckTrailerCount: formData.get("truckTrailerCount") || 0,
    semiTruckCount: formData.get("semiTruckCount") || 0,
    contestDayConflicts: formData.get("contestDayConflicts") ?? "",
    specialNeeds: formData.get("specialNeeds") ?? "",
  });
}

/** Column names in the bands table. */
export function bandColumns(v: BandInput) {
  return {
    school_name: v.schoolName,
    band_name: v.bandName,
    classification: v.classification,
    school_address: v.schoolAddress,
    contact_email: v.contactEmail,
    head_director_name: v.headDirectorName,
    head_director_email: v.headDirectorEmail,
    head_director_phone: v.headDirectorPhone,
    assistant_directors: v.assistantDirectors,
    student_count: v.studentCount,
    chaperone_count: v.chaperoneCount,
    bus_count: v.busCount,
    box_truck_count: v.boxTruckCount,
    truck_trailer_count: v.truckTrailerCount,
    semi_truck_count: v.semiTruckCount,
    contest_day_conflicts: v.contestDayConflicts,
    special_needs: v.specialNeeds,
  };
}

export type BandRow = {
  id: string;
  event_id: string;
  director_user_id: string;
  school_name: string;
  band_name: string;
  classification: string;
  school_address: string;
  contact_email: string;
  head_director_name: string;
  head_director_email: string;
  head_director_phone: string;
  assistant_directors: string[];
  student_count: number;
  chaperone_count: number;
  bus_count: number;
  box_truck_count: number;
  truck_trailer_count: number;
  semi_truck_count: number;
  contest_day_conflicts: string | null;
  special_needs: string | null;
  status: string;
  created_at: string;
};

export const BAND_COLUMNS =
  "id, event_id, director_user_id, school_name, band_name, classification, school_address, contact_email, head_director_name, head_director_email, head_director_phone, assistant_directors, student_count, chaperone_count, bus_count, box_truck_count, truck_trailer_count, semi_truck_count, contest_day_conflicts, special_needs, status, created_at";
