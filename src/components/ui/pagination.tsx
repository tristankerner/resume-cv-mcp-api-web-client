import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

// Buttons rather than shadcn's stock `<a>` links — this app's pagination has
// no real URLs behind it (no router), just an offset the caller re-fetches
// with.
type PaginationButtonProps = React.ComponentProps<typeof Button> & { isActive?: boolean };

function PaginationButton({ className, isActive, variant, size = "icon", ...props }: PaginationButtonProps) {
  return (
    <Button
      type="button"
      data-slot="pagination-link"
      data-active={isActive}
      variant={variant ?? (isActive ? "outline" : "ghost")}
      size={size}
      className={cn(className)}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationButton>) {
  return (
    <PaginationButton
      aria-label="Go to previous page"
      size="default"
      variant="outline"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationButton>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationButton>) {
  return (
    <PaginationButton
      aria-label="Go to next page"
      size="default"
      variant="outline"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationButton>
  );
}

export { Pagination, PaginationButton, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious };
