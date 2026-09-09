import * as React from "react";

// Sanctioned edit to generated code: shadcn's stock value is 768, but this
// project redefines Tailwind's `md:` breakpoint to 720px (`--breakpoint-md`
// in src/index.css) so the old single-file client's table-reflow threshold
// is preserved. Keeping this at 768 would open a 720-768px band where the
// sidebar's own internal classes (which key off `md:`) disagree with this
// hook about whether the viewport is "mobile".
const MOBILE_BREAKPOINT = 720;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
