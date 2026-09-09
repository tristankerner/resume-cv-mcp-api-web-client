import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const itemVariants = cva(
  "group/item flex flex-wrap items-center rounded-md text-sm outline-none transition-colors",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border p-3",
        muted: "bg-muted/50 p-3",
      },
      size: {
        default: "gap-3",
        sm: "gap-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Item({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return (
    <div data-slot="item" className={cn(itemVariants({ variant, size, className }))} {...props} />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("ml-auto flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

export { Item, ItemActions, ItemContent, ItemDescription, ItemTitle };
