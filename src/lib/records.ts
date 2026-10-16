import { brand } from "@/lib/brand";

// Who owns copies taken out of the app. The information belongs to the school
// or organization running the event; once printed, downloaded, or copied, a
// copy is their record, kept under their own policies, and our deletion
// schedule no longer reaches it. All the wording is here so it can be updated
// in one place after the attorney's review of the privacy policy and terms.

/** Next to Print, Copy, and similar buttons. */
export const RECORDS_NOTE = `Copies you print, save, or copy are your school's or organization's records. Keep or dispose of them under your own policies. ${brand.name} deletes only what's stored in the app.`;

/** At the bottom of every printed page. */
export const printedNote = (date: string) =>
  `Printed from ${brand.name} on ${date}. This copy is your school's or organization's record. Keep or dispose of it under your own policies.`;

/** Above the button that creates an account. */
export const ACCOUNT_RECORDS_NOTE = `Information your families, volunteers, and visitors give is your school's or organization's, and we store it for you. Anything you print, download, or copy from ${brand.name} becomes your own record to keep under your policies.`;
