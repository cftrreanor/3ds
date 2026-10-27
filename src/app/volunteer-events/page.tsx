import { AudiencePage, audienceMetadata } from "@/components/audience-page";
import { audiences } from "@/lib/audiences";

export const metadata = audienceMetadata(audiences.volunteers);

export default function Page() {
  return <AudiencePage audience={audiences.volunteers} />;
}
