import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function DataTableFooter({
  total,
  limit,
  offset,
  onOffsetChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  if (total === 0) return null;

  const from = offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              disabled={offset === 0}
              onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext disabled={to >= total} onClick={() => onOffsetChange(offset + limit)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
