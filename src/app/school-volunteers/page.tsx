import { permanentRedirect } from "next/navigation";

/** The volunteer events page moved to /volunteer-events; old links still work. */
export default function Page() {
  permanentRedirect("/volunteer-events");
}
