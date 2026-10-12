import { AudiencePage, audienceMetadata } from "@/components/audience-page";
import { audiences } from "@/lib/audiences";

export const metadata = audienceMetadata(audiences.parents);

export default function Page() {
  return <AudiencePage audience={audiences.parents} />;
}
