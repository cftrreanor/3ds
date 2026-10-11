import { dismissBanner } from "@/app/banner-actions";
import { bannersForUser } from "@/lib/site-banners";
import { SiteBannerView } from "./site-banner";

/** Company banners for the signed-in person, at the top of their pages. */
export async function UserBanners({ userId }: { userId: string }) {
  const banners = await bannersForUser(userId);
  if (banners.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {banners.map((b) => (
        <SiteBannerView key={b.id} banner={b} onDismiss={dismissBanner.bind(null, b.id)} />
      ))}
    </div>
  );
}
