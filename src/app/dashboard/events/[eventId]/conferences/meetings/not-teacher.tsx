import Link from "next/link";
import { Card } from "@/components/ui";

/** Another host on the account: the bookings are the teacher's (or the meetings' organizer's) alone. */
export function NotTheTeacher({ eventId, booked, meeting = false }: { eventId: string; booked: number; meeting?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to the {meeting ? "meetings" : "conference"}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Your meetings</h1>
      <Card className="mt-6 space-y-2">
        <p className="font-medium">
          {booked} {booked === 1 ? "time is" : "times are"} booked.
        </p>
        <p className="text-sm text-muted">
          {meeting ? (
            "Only the person who set up these meetings can see who booked and their notes. People booking are told that only they see their details."
          ) : (
            <>
              Only the teacher who set up this conference can see who booked and families&apos; notes. Families are told that only their child&apos;s
              teacher sees their details.
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
