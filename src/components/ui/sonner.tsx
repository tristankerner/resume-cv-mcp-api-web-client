import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Dark-only, same as the rest of the app — see index.css. shadcn's stock
// version reads the theme from next-themes; there is no theme to read here.
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
