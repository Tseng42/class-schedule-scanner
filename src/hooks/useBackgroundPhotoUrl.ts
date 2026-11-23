import { useEffect, useState } from "react";
import { loadBackgroundPhoto } from "../services/storage/backgroundPhoto";

/**
 * An object URL for the stored background photo, or null when there is none.
 * Bump `version` to reload it after the photo changes.
 */
export function useBackgroundPhotoUrl(version = 0): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void loadBackgroundPhoto().then((photo) => {
      if (cancelled) return;
      objectUrl = photo ? URL.createObjectURL(photo) : null;
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version]);

  return url;
}
