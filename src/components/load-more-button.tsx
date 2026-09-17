import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

type LoadMoreButtonProps = {
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onLoadMore: () => void;
  pageSize?: number;
};

/** "Load more" button for usePaginatedQuery lists. Renders nothing once exhausted. */
export default function LoadMoreButton({
  status,
  onLoadMore,
  pageSize = 20,
}: LoadMoreButtonProps) {
  if (status === "Exhausted" || status === "LoadingFirstPage") return null;

  return (
    <div className="flex justify-center pt-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={status === "LoadingMore"}
        onClick={() => onLoadMore()}
      >
        {status === "LoadingMore" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </>
        ) : (
          `Load more (${pageSize})`
        )}
      </Button>
    </div>
  );
}
