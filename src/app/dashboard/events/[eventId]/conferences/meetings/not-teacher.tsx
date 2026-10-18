import Link from "next/link";
import { Card } from "@/components/ui";

/** Another host on the account: the bookings are the teacher's alone. */
export function NotTheTeacher({ eventId, booked }: { eventId: string; booked: number }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to the conference
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Your meetings</h1>
      <Card className="mt-6 space-y-2">
        <p className="font-medium">
          {booked} {booked === 1 ? "time is" : "times are"} booked.
        </p>
        <p className="text-sm text-muted">
          Only the teacher who set up this conference can see who booked and families&apos; notes. Families are told that only their child&apos;s
          teacher sees their details.
        </p>
      </Card>
    </div>
  );
}
