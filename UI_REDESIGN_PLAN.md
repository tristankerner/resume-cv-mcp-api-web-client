# UI redesign plan — sidebar shell, full-width content, more shadcn

**Status: proposal, not committed, nothing implemented.**

Target: the layout of <https://ui.shadcn.com/examples/dashboard> — a fixed
left sidebar with grouped navigation, a slim sticky header carrying the
sidebar trigger and breadcrumb, and page content that uses the full width
underneath. Still responsive to a phone, still one HTML file, no feature
removed.

---

## 1. What is already true

Worth stating, because it changes how big this is. The app is already
shadcn/ui new-york on Tailwind v4 with CSS-variable theming, and the feature
views already compose `Card`/`Table`/`Dialog`/`AlertDialog`/`Select`/
`Switch`/`Badge`/`Input`/`Label`/`Textarea`/`Tabs`/`Tooltip`/`DropdownMenu`.
This is not a rewrite. The work is:

- the **shell** — [AppShell.tsx](src/components/layout/AppShell.tsx) is a
  flex column with `<main className="mx-auto w-full max-w-4xl p-5">`, and
  [Nav.tsx](src/components/layout/Nav.tsx) is a flat row of ghost `Button`s
  inside [Header.tsx](src/components/layout/Header.tsx). That is the whole
  of the current navigation and it is what gets replaced.
- the **remaining hand-rolled bits** — a combobox, radio inputs, `<details>`,
  `<dl>` blocks, `<ul>` card-lists, ad-hoc `Loading…` paragraphs, and the
  `space-y-1.5 > Label + Input + hint` idiom repeated ~50 times.

### Constraints this plan must not break

| Constraint | Where it lives | Consequence for this plan |
| --- | --- | --- |
| **Single-file build** | [vite.config.ts](vite.config.ts), [scripts/check-singlefile.mjs](scripts/check-singlefile.mjs); `dist/index.html` is ~1.7 MB today | Every new dependency is inlined into that file. Bundle deltas are a first-class review criterion below. |
| **Must work from `file://`** | README, `GET /client` sends no `script-src` | No runtime fetches; **and cookies are unreliable** — see the sidebar-state gotcha in §6.3. |
| **No router** | [store.ts](src/store/store.ts) — a `view` string plus `viewParams` | Sidebar items call `store.navigate(...)`; active state is derived, not from a URL. Browser Back stays inert (unchanged, not a new regression). |
| **`--breakpoint-md` is 45rem (720px)** | [index.css](src/index.css:78) — deliberately not Tailwind's 768px | shadcn's `use-mobile` hook defaults to 768. Must be aligned or a 720–768px band gets a desktop table inside a mobile sidebar. See §6.2. |
| **`components/ui/` is generated** | README | Prefer configuring via props/CSS vars over hand-editing. Exactly one sanctioned edit is proposed (`use-mobile.ts`), and it gets a comment + README line. |
| **Scope gating drives the UI** | [scopes.ts](src/lib/auth/scopes.ts) | Nav groups must disappear entirely when empty, not render as an empty heading. |
| **Tests cover pure logic only** | README, [vitest.config.ts](vitest.config.ts) | The gate stays `npm run typecheck && npm run test && npm run build`. New pure helpers (`VIEW_META` resolution) get unit tests; components do not. |

---

## 2. Information architecture

The grouping ask, resolved. Four blocks in the sidebar, plus a user card in
the footer.

```
┌─ SidebarHeader ─────────────┐
│  resume-api                 │   brand + API-base indicator
├─ SidebarContent ────────────┤
│  Resume Fine-Tuning         │
│    Documents                │   documents · create · edit
│                             │   one item; page splits — see §2.2
│                             │
│  Application Tracking       │   hidden unless canReadAnyTracking(user)
│    Applications             │   applications · application · application-create
│    Companies                │   companies · company · company-create
│    Contacts                 │   contacts · contact · contact-create
│                             │
│  Administration             │   hidden unless isAdmin(user)
│    Users                    │   admin-users
│    OAuth clients            │   admin-oauth-clients
│                             │
│  ─── mt-auto ───            │
│    API keys                 │   NavSecondary, pinned to the bottom
│    Security                 │
│    Account                  │
├─ SidebarFooter ─────────────┤
│  ▸ tristan          ⌄       │   dropdown: session countdown, Log out
└─────────────────────────────┘
```

Group labels are the literal strings shown above — Title Case, rendered as-is
by `SidebarGroupLabel`, which does not uppercase. The secondary block carries
no label at all. Rationale in §10.1.

The desktop sidebar is `collapsible="icon"` (confirmed in scope): it rails
down to a 3rem icon strip, toggled by the header trigger or shadcn's built-in
⌘B. That makes ⌘K (§7, Phase 10) close to load-bearing rather than a luxury,
since a railed sidebar shows icons and no text.

**Why "API keys / Security / Account" are a bottom secondary block and not
inside Administration:** they are *your* credentials, not site
administration — the thing the user asked to separate. And the README calls
API-key management "the task this client is built to be good at from a
phone", which argues against burying it one level deep in a footer dropdown
the way the shadcn example buries settings. A pinned secondary nav block is
the shadcn dashboard's own idiom for exactly this (`NavSecondary`,
`className="mt-auto"`).

**Group labels are gated, not just their items.** `ADMINISTRATION` renders
only for `isAdmin(user)`; `APPLICATION TRACKING` only when at least one of
the three `*:read` scopes is held (`canReadAnyTracking` already exists and
is currently unused — this is what it was written for). A user with none of
them sees a two-block sidebar, not a heading over nothing.

### 2.1 `VIEW_META` — one source of truth

Today [Nav.tsx](src/components/layout/Nav.tsx:28) has a `NAV_GROUP` map
answering "which nav item does this view highlight". The redesign needs the
same answer three more times (breadcrumb parent, breadcrumb label, mobile
header title). Collapse them:

```ts
// src/store/views.ts — pure, unit-testable, no JSX
export interface ViewMeta {
  label: string;                 // "Applications", "New application"
  group: NavGroupId;             // which sidebar block owns it
  parent?: View;                 // breadcrumb ancestor; absent = top level
  navItem?: View;                // sidebar item to highlight; defaults to parent ?? self
}
export const VIEW_META: Record<View, ViewMeta> = { ... };
```

This is the one piece with real logic, so it gets tests
(`src/store/views.test.ts`): every `View` in the union has an entry
(exhaustiveness via a mapped type, caught at compile time), every `parent`
resolves, no cycles.

### 2.2 Documents page — one nav item, three tables

`Documents` stays a single sidebar entry. Inside the page, the one sorted
list at [DocumentListView.tsx:64](src/features/documents/DocumentListView.tsx:64)
becomes three sections — **Resumes**, **Metadata**, **Skills** — each its own
`Card` with a title, a count badge, and its own `Table`.

Mechanically this is small: the view already sorts by `type` then `name`
([DocumentListView.tsx:25](src/features/documents/DocumentListView.tsx:25)),
so the change is a `group by doc.type` over `DOC_TYPES` instead of one flat
array, rendered in a `.map`.

What it fixes beyond looks: the `Type` column disappears (it becomes the
section heading — one less column in a table that reflows to stacked cards on
a phone), and per-type scope gating gets *legible*. Today a user who can read
resumes but not skills just sees a shorter list with no indication anything
is gated. With sections, a type in `readableTypes(user)` but empty renders
"No resumes yet." and a type the user cannot read is absent entirely — the
existing "You cannot read any type of document." message
([DocumentListView.tsx:60](src/features/documents/DocumentListView.tsx:60))
then only has to cover the all-or-nothing case it actually reads as.

Ordering follows `DOC_TYPES` (`resume`, `metadata`, `skill`) rather than
alphabetical, so it matches the API's own ordering and the create form's.

Note: `components/ui/tabs.tsx` is generated but **unused anywhere in the app**
today. If three stacked full-width tables turn out to be a lot of scrolling on
a phone, tabs are already paid for and a one-line swap. Starting with stacked
sections as asked — they are scannable without a click, which matters more on
the screen where you are looking for one document by name.

---

## 3. Layout

### AppShell

```tsx
<SidebarProvider open={open} onOpenChange={setOpen}>
  <AppSidebar />
  <SidebarInset>
    <SiteHeader />          {/* sticky: trigger · breadcrumb · countdown */}
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {children}
    </div>
  </SidebarInset>
</SidebarProvider>
```

- **Full width**: `max-w-4xl` comes off `<main>`. Content spans the inset.
- **Per-page width is a page decision, not a shell decision.** Tables, detail
  views and the JSON editor go edge to edge. Single-column create/edit forms
  get `max-w-3xl` locally — a 2400px-wide text input is worse, not better.
  Concretely: `CreateDocumentView`, `CreateApplicationView`,
  `CreateCompanyView`, `CreateContactView`, `AccountView`'s change-password
  card.
- **`SiteHeader`** absorbs what [Header.tsx](src/components/layout/Header.tsx)
  does now: `SidebarTrigger`, a `Separator`, the breadcrumb, and — pushed
  right — `SessionCountdown`. Username and Log out move to the sidebar
  footer's `NavUser` dropdown. Nothing is lost; the countdown deliberately
  stays in the header because it is a warning and must not need a click.
- **Login overlay is untouched.** `LoginView` is a `fixed inset-0` overlay
  rendered as a sibling of `AppShell` in [App.tsx](src/App.tsx:69); it sits
  above the sidebar for free.
- **The no-MFA banner** stays at the top of the content area, inside the
  inset.

### Breadcrumb

`Documents` / `Applications › Acme Corp` / `Applications › New application`.
Driven entirely by `VIEW_META` plus the loaded record's display name (which
detail views already have in state — a `store.setCrumb(name)` or, simpler, a
`crumb?: string` field the detail view sets alongside its fetch). On mobile
the breadcrumb truncates to the leaf via `BreadcrumbItem className="hidden
md:block"`, same as the shadcn example.

### Mobile

- Sidebar collapses to an off-canvas `Sheet` below the breakpoint; the
  trigger is the first thing in the header, thumb-reachable.
- **`collapsible="icon"` on desktop.** Every item therefore needs a lucide
  icon (`FileText`, `Briefcase`, `Building2`, `Users`, `Shield`, `KeyRound`,
  `UserCog`, `AppWindow`); `lucide-react` is already a dependency and
  tree-shakes per icon. Two consequences that are easy to miss:
  - Every `SidebarMenuButton` must be given the `tooltip` prop. It renders
    *only* when the sidebar is collapsed, so an item without one becomes a
    bare unlabelled icon in the rail. `tooltip.tsx` is already generated.
  - Group labels are hidden in the rail, so the grouping in §2 stops being
    visible when railed. Items are still ordered by group and separated, but
    this is the second argument for ⌘K.
- shadcn's sidebar binds **⌘B / Ctrl-B** to the toggle internally. No conflict
  with ⌘K, but worth knowing it exists before someone reports it as a ghost.
- `table-reflow` keeps working unchanged — it is a media query on the same
  720px, independent of the sidebar.
- Content padding drops to `p-4` under `md`.

---

## 4. shadcn components to adopt

Ordered by value. "New dep" means a package added to `package.json` and
therefore inlined into `dist/index.html`.

### Adopt — clear wins

| Component | Replaces | New dep |
| --- | --- | --- |
| `sidebar` + `sheet` | `Nav.tsx`, `Header.tsx`, `AppShell.tsx` | none — uses `@radix-ui/react-dialog`, already present |
| `breadcrumb` | nothing (new affordance the sidebar layout needs) | none |
| `field` (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldSet`) | the `<div className="space-y-1.5"><Label/><Input/><p className="text-xs text-muted-foreground"/></div>` idiom, ~50 occurrences across every form | none |
| `empty` | [EmptyState.tsx](src/components/common/EmptyState.tsx) | none |
| `spinner` | ~10 copies of `<p className="text-sm text-muted-foreground">Loading…</p>` | none |
| `skeleton` | **already generated, currently unused** — table/card skeletons on first load instead of a bare `Loading…` | none |
| `item` | the `<li className="rounded-md border p-3">` lists — events in [ApplicationDetailView.tsx:670](src/features/applications/ApplicationDetailView.tsx:670), [HistoryPanel.tsx:79](src/features/tracking/HistoryPanel.tsx:79), and `CompanyDetailView`'s three `<ul>`s | none |
| `button-group` | `Edit`/`Delete` action pairs in `PageHeader`, `Download`/`Delete` in attachment rows | none |
| `pagination` | [DataTableFooter.tsx](src/components/common/DataTableFooter.tsx)'s two bare buttons | none |
| `collapsible` | `<details>/<summary>` "Raw JSON side by side" in [RevisionPanel.tsx:196](src/features/documents/RevisionPanel.tsx:196); optionally collapsible sidebar groups | `@radix-ui/react-collapsible`, ~3 KB |
| `radio-group` | raw `<input type="radio">` L/R compare pickers in [RevisionPanel.tsx:42](src/features/documents/RevisionPanel.tsx:42) — currently unstyled and unlabelled for screen readers | `@radix-ui/react-radio-group`, ~5 KB |
| `popover` + `command` | [CompanyPicker.tsx](src/features/tracking/CompanyPicker.tsx) — 177 lines of hand-rolled combobox: own debounce, own arrow-key handling, `onBlur` + `setTimeout(100)` to close, no `aria-activedescendant`, no listbox roles | `@radix-ui/react-popover` (~6 KB) + `cmdk` (~15 KB) |
| `toggle-group` | [ModeToggle.tsx](src/features/documents/ModeToggle.tsx) (tree/text), and the status filter chips at [ApplicationListView.tsx:184](src/features/applications/ApplicationListView.tsx:184) which are `<button><Badge/></button>` — a multi-select `ToggleGroup` is exactly that control, with keyboard support | `@radix-ui/react-toggle-group` + `@radix-ui/react-toggle`, ~5 KB |
| `input-group` | the search-with-icon field and the `from —to` date pair in `ApplicationListView` | none |

Two primitives are **already in `components/ui/` and imported by nothing**:
`skeleton.tsx` and `tabs.tsx`. They cost bundle weight today and return
nothing. This redesign should either use them (skeleton: yes, see above;
tabs: see §2.2) or delete them.

**Estimated added weight: ~35–40 KB minified**, dominated by `cmdk`. Against
a 1.7 MB single file that is ~2%.

`cmdk` now has **two** consumers — the command palette (§7, Phase 10) and the
`CompanyPicker` rewrite (Phase 11) — which settles a question the previous
draft left open. It is no longer optional, and the "keep the hand-rolled
picker, drop `cmdk`" fallback is off the table. Both consumers pass
`shouldFilter={false}`: `Command` filters client-side by default, while both
of these filter server-side over an existing `?query=` endpoint.

### Adopt — smaller, mechanical

- `PageHeader` → keep the component, but make it universal. Six views use it
  and five use a bare `<h2 className="mb-4 text-xl font-semibold">`
  ([ApiKeysView](src/features/api-keys/ApiKeysView.tsx:83),
  [SecurityView](src/features/security/SecurityView.tsx:61),
  [AccountView](src/features/account/AccountView.tsx:64),
  `CreateDocumentView`, `CreateCompanyView`, `CreateContactView`,
  `CreateApplicationView`, `EditDocumentView`). Once the breadcrumb exists the
  page title should be defined in exactly one place.
- `Banner` → keep. It already wraps `Alert`; the only change is that `mb-4` on
  the alert should become the caller's business now that the shell owns
  spacing (`gap-4` on the content flex column).
- `dl/dt/dd` detail blocks in `ApplicationDetailView`, `CompanyDetailView`,
  `ContactDetailView` → these are semantically correct HTML. Wrap in a small
  local `DetailList`/`DetailRow` pair (in `components/common/`) for
  consistency rather than reaching for a shadcn primitive that does not exist.

### Explicitly **not** adopting

- **`@tanstack/react-table` / the shadcn data-table recipe.** ~45 KB for
  sorting, column visibility and row selection that no screen asks for, and it
  fights `table-reflow`, which is the entire mobile story for six tables.
- **`recharts` / the `chart` component.** ~400 KB inlined. Nothing in the app
  charts anything today.
- **`avatar`.** A `div` with two initials costs nothing and the app has no
  avatar URLs.
- **A dashboard landing page with stat cards** (applications by status,
  expiring keys, document counts). It fits the reference design and would be
  genuinely useful, but it is *new functionality*, not a redesign of existing
  functionality — and it needs API aggregate endpoints or N client-side
  queries. Flagged here as the obvious follow-up; out of scope unless asked
  for.
- **A router.** Making the sidebar deep-linkable is a real improvement and a
  separate change with its own risks (`file://` and hash routing, session
  restore, the `viewParams` shape). Not bundled into a layout change.

---

## 5. Light and dark theme

In scope. The sidebar footer is the natural home for the toggle (next to
`NavUser`), which is why it rides along with this change rather than waiting.

[index.css](src/index.css:6) was written for this — "a future light theme is a
token swap plus a toggle, not a rewrite". That is true of the tokens. It is
not quite true of everything else, and the two exceptions are the whole risk:

1. **`<html lang="en" class="dark">` is hardcoded** in
   [index.html](index.html). The toggle owns that class now.
2. **The JSON editor is unconditionally dark.**
   [JsonEditorField.tsx:69](src/features/documents/JsonEditorField.tsx:69)
   renders `className="json-editor-host jse-theme-dark"` and
   [line 12](src/features/documents/JsonEditorField.tsx:12) statically imports
   `vanilla-jsoneditor/themes/jse-theme-dark.css`. In light mode that leaves a
   dark slab in the middle of a light page — on the app's most-used editing
   screen. The class must become conditional on the resolved theme. Keep the
   CSS import unconditional: it is scoped entirely under `.jse-theme-dark`, so
   it is inert when the class is absent, and making the *import* conditional
   would mean a dynamic import, which the single-file build cannot do.

### Shape

```ts
// src/lib/theme.ts — pure, unit-testable
export type ThemePreference = "light" | "dark" | "system";
export function resolveTheme(pref: ThemePreference, prefersDark: boolean): "light" | "dark";
```

- Three-way preference, not a boolean: `system` follows
  `prefers-color-scheme` and is the sensible default for a first visit.
- Persisted to **localStorage**, key `resume-api-client.theme`, matching the
  convention in [config.ts](src/lib/config.ts:6). Not a cookie — same
  `file://` reasoning as the sidebar state (§6.3).
- A `useTheme` hook applies/removes `.dark` on `document.documentElement` and
  subscribes to the `prefers-color-scheme` media query so `system` tracks an
  OS change live.
- Toggle UI: a `DropdownMenu` with Light / Dark / System (`Sun`, `Moon`,
  `Monitor` from lucide, already a dependency). A two-state button cannot
  express "system", and losing that is worse than the extra click.

### Token work

Today `:root` holds only `--radius`; the full palette lives under `.dark`.
Light means authoring a `:root` set — shadcn's stock slate light values are
the right starting point, since `components.json` already declares
`"baseColor": "slate"` — and keeping `.dark` as the override. `@theme inline`
needs no change; it already maps through the variables. The custom
`--success` / `--warning` pairs are **not** in shadcn's stock set and have no
light counterpart yet; they need hand-picked light values that hold contrast
against a light background (the current `hsl(142 71% 45%)` success is tuned
for dark and will be too pale on white).

### Anti-FOUC

The theme must be on `<html>` before first paint or a dark-preferring user
gets a white flash on every load. A small blocking inline script in
`index.html`'s `<head>` reading localStorage and setting the class is the
standard fix, and it is safe here specifically because `GET /client`
deliberately sends **no `script-src`** (see the `CLIENT_HEADERS` note in the
README) — an inline script needs no hash and no `unsafe-inline`. Confirm
`vite-plugin-singlefile` preserves it verbatim and that
`scripts/check-singlefile.mjs` still passes; the checker skips `<script>`
bodies but does inspect attributes, so the tag must carry no `src`.

### Verification

Both themes on every screen, but specifically: the JSON editor, the
`success`/`warning` Banner variants, `Badge variant="warning"` on the job-code
`+N`, the destructive session countdown, the login overlay's `bg-black/60`
scrim (which reads as a heavy dim over a light page — likely wants
`bg-background/80` + `backdrop-blur`), and the new sidebar tokens in §6.1.

---

## 6. Gotchas that will actually bite

1. **Sidebar tokens are missing from the theme.** `sidebar.tsx` expects
   `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
   `--sidebar-primary-foreground`, `--sidebar-accent`,
   `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`. They
   must be added to the `.dark` block in [index.css](src/index.css:13) *and*
   mapped in `@theme inline`, following the existing pattern exactly. Without
   them the sidebar renders transparent-on-transparent. Suggested: `--sidebar`
   one step lighter than `--background` (e.g. `hsl(222.2 47% 8%)`) so the rail
   reads as a distinct surface against `--card`, which currently equals
   `--background`.

2. **`use-mobile` breakpoint mismatch.** shadcn generates
   `src/hooks/use-mobile.ts` with `MOBILE_BREAKPOINT = 768`, while the sidebar's
   own internal classes use Tailwind's `md:` — which this project has
   redefined to 720px. Set the constant to 720 so the two agree, with a
   comment pointing at the `--breakpoint-md` comment in `index.css`, and add a
   README line under "Mobile" recording it as a sanctioned edit to generated
   code. (`src/hooks/` does not exist yet; `components.json` already aliases
   `@/hooks`.)

3. **Sidebar open/closed state uses a cookie.** `SidebarProvider` writes
   `sidebar_state` to `document.cookie`, which is unreliable — often silently
   dropped — for a page loaded from `file://`. Drive it as a controlled
   component instead: `open` / `onOpenChange` backed by `localStorage` under
   the existing `resume-api-client.*` key convention from
   [config.ts](src/lib/config.ts:6). Same fix pattern as the session cache
   already uses.

4. **Sidebar widths without editing generated code.** `SIDEBAR_WIDTH` and
   friends are consts inside `sidebar.tsx`. Override via the `style` prop on
   `SidebarProvider` (`--sidebar-width`, `--sidebar-width-icon`,
   `--sidebar-width-mobile`) rather than editing the file.

5. **Full width exposes unbounded text columns.** `job_description`,
   `initial_prompt_text`, audit values and revision notes currently sit inside
   a 4xl container that clamps them. At 2400px they will stretch to
   unreadable line lengths. Long-text table cells need `max-w-[40ch]` +
   `truncate` (with the full value in `title`, the pattern
   [HistoryPanel](src/features/tracking/HistoryPanel.tsx:21) already uses), and
   `whitespace-pre-wrap` detail fields need a `max-w-prose`.

6. **The JSON editor host is a fixed `height: 480px`**
   ([index.css](src/index.css:105)). With the extra width it should grow —
   `height: clamp(360px, 60vh, 720px)` — but `vanilla-jsoneditor` injects its
   own layout CSS, so this needs checking in the browser, not just reasoning.

7. **`body { overflow-x: hidden }`** ([index.css](src/index.css:91)) will mask
   a sidebar-induced horizontal overflow rather than showing it. Verify at
   375px with it temporarily off; `Table` already provides its own
   `overflow-x-auto` container, so any overflow found is a shell bug.

8. **`CardHeader className="flex-row items-center justify-between"`**
   ([ApplicationDetailView.tsx:656](src/features/applications/ApplicationDetailView.tsx:656))
   fights the current `CardHeader` grid. Worth fixing with `CardAction` (the
   supported slot) while in the area.

---

## 7. Phasing

Each phase is independently shippable and ends green on
`npm run typecheck && npm run test && npm run build`.

**Phases 1–6 change behaviour or structure** and each deserves its own review.
**Phases 7–12 are the component sweep** — mostly mechanical, and safe to batch
if you would rather review them together.

### Structural

**Phase 1 — shell.** Add `sidebar`, `sheet`, `breadcrumb`; add sidebar tokens
to `index.css`; add `src/hooks/use-mobile.ts` with the 720 fix; add
`src/store/views.ts` (`VIEW_META`) + its test; rewrite `AppShell`, replace
`Header` with `SiteHeader`, replace `Nav` with `AppSidebar` + `NavUser`;
`collapsible="icon"` with a `tooltip` on every menu button; `max-w-4xl` off.
Verify: every one of the 17 views still reachable, scope gating identical, log
out works, session countdown visible, 375px sheet opens and closes, railed
sidebar shows a tooltip for every item.

**Phase 2 — full-width pass.** Per-page width decisions, long-text clamps,
JSON editor height, `CardAction` fix. Verify at 375 / 720 / 1280 / 2560px.

**Phase 3 — theme.** `src/lib/theme.ts` + `resolveTheme` test, `useTheme`
hook, light `:root` token set incl. light `--success`/`--warning`, conditional
`jse-theme-dark`, the anti-FOUC inline script, toggle in the sidebar footer.
Ships after the shell so the toggle has somewhere to live, and before the
cosmetic phases so everything after it is reviewed in both themes. Verify per
§5.

**Phase 4 — documents split.** Three sections in `DocumentListView`, `Type`
column removed, per-type empty states. Small and self-contained.

**Phase 5 — page titles.** `PageHeader` everywhere, breadcrumbs wired to
detail-view record names. Removes the five bare `<h2>`s.

**Phase 6 — list state persistence.** The six `ApplicationListView` filters
plus `offset`, and the smaller filter sets on the company and contact lists,
move out of component `useState` into store slices keyed by view — so opening
a row and coming back preserves them. Also covers `ApiKeysView`'s
`showInactive` switch. Pure behaviour change with no visual component, which
is exactly why it is its own phase: it is the one item here that a screenshot
review would miss. Verify: filter, open a detail, go back, filters intact;
log out and back in clears them.

### Component sweep

**Phase 7 — forms.** `field` + `input-group` across the ~50 label/input
blocks. Purely mechanical, largest diff, zero behaviour change.

**Phase 8 — lists and states.** `empty` (with action slots — "No applications
yet." gains a **New application** button), `spinner`, `skeleton`, `item`,
`button-group`, `pagination`, sticky table headers, the `DetailList` helper.

**Phase 9 — inputs.** `radio-group` and `collapsible` in `RevisionPanel`;
`toggle-group` for `ModeToggle` and the status filter chips.

**Phase 10 — command palette.** Introduces `popover` + `command` + `cmdk`.
⌘K/Ctrl-K `CommandDialog` with two sections: **Go to** (every nav-reachable
view, filtered by the same scope predicates the sidebar uses — one shared
helper, so a hidden nav item can never be reachable by palette) and **Search**
(applications, companies, contacts via the existing `?query=` endpoints,
debounced 300 ms, `shouldFilter={false}`). Trigger also rendered as a button
in `SiteHeader`, since a keyboard-only affordance is invisible on a phone.

**Phase 11 — combobox.** `CompanyPicker` rebuilt on the `command` + `popover`
that Phase 10 just added. Last of the sweep because it is the only one with
real interaction logic to preserve — inline company creation,
duplicate-conflict handling
([CompanyPicker.tsx:84](src/features/tracking/CompanyPicker.tsx:84)), the
"— no company —" option, and `valueLabel` seeding.

**Phase 12 — feedback rule.** Settle toast vs Banner: transient success →
`toast`; anything that must persist or blocks progress → `Banner`. Currently
`toast` appears in exactly five admin call sites and success is an inline
`Banner` everywhere else. Small, and last because it is the easiest to defer.

---

## 8. Nothing lost — the checklist

Regression list to walk before calling this done. Every view, and every
action that is not a link.

**Documents** — list (now three sections, per-type read gating, "New
document" only with a writable type) · create · edit (JSON editor tree/text
toggle, save with revision note, public toggle, rename, delete, revisions
table, L/R compare including "Current", restore, raw-JSON side-by-side).

**Applications** — list (text search, job-code filter, company filter, status
multi-select, submitted from/to, clear filters, pagination, `+N` job-code
badge) · detail (inline edit of every field incl. three document refs,
manually-modified switch, delete, Same-job-code card, events add/edit/delete
with status·contact·rating·occurred-at, attachments upload/download/delete,
history panel) · create.

**Companies** — list, detail (edit, delete, stack items, relationships,
contacts, history), create.

**Contacts** — list, detail (edit, delete, rating, history), create,
create-prefilled-from-company.

**API keys** — create (scope selection, expiry), one-time reveal + copy,
show-expired/revoked switch, revoke.

**Security** — MFA credential table, enroll TOTP (password confirm → QR →
activate → cancel-cleans-up), backup codes generate/regenerate + one-time
reveal, remove credential.

**Account** — identity card (roles, scopes), change password with live
complexity checks and the off-screen `autocomplete="username"` field.

**Admin** — users list, create user, reset password, reset MFA, unlock;
OAuth clients list, register client (public/confidential), one-time secret
reveal.

**Cross-cutting** — session countdown under 5 min, no-MFA dismissible banner,
401 → login overlay with work preserved, clipboard feature-detection on
`file://`, toasts, `table-reflow` on all six tables, **both themes on every
screen**.

---

## 9. Deferred — deliberately not in this change

The earlier proposals are now folded into §7: the command palette is Phase 10,
list-state persistence is Phase 6, sticky headers and empty-state actions are
Phase 8, and the toast/Banner rule is Phase 12. Two things stay out, on
purpose.

**9.1 One async-state pattern.** Roughly twenty views repeat the same four
things: a `load()`, an `error` string, `null`-means-loading, and
`if (err instanceof ApiError && err.status === 401) return;`. A ~40-line
`useResource` hook would collapse that and make Phase 8's
skeleton/empty/error rendering consistent by construction instead of by
discipline.

Still recommending this be its own change *after* the sweep, and the reason is
concrete rather than caution: it rewrites the data layer of every view, so if
it rides along with Phase 8 then every "did this list break?" question during
review has two candidate causes instead of one. The sweep is what makes it
easy to do afterwards — by then all twenty views render loading and error
states through the same components, so the hook is extracting a shape that
already exists rather than inventing one. First change after this plan lands.

**9.2 Hash routing.** The honest tension in this plan: a sidebar, breadcrumbs
and a command palette all make the app *feel* navigable, and then browser Back
does nothing and no application is linkable. Hash routing works fine from
`file://` and is maybe 60–80 lines against the existing `view` + `viewParams`
store. But it needs care around session restore and the `viewParams` shape,
and it is a behaviour change wearing a layout change's clothes. Ship the
redesign first, then do this deliberately — noting that Phase 6 relieves much
of the pain that makes it urgent.

**9.3 Overview/dashboard landing page.** Stat cards (applications by status,
keys expiring soon, document counts). Fits the reference design, genuinely
useful, but it is new functionality needing either API aggregates or several
client-side queries. Separate change, and no `recharts` — plain `Card`s.

---

## 10. Decisions on record

No open questions. This section exists because the plan is the only durable
record of these — they were settled in discussion, not derivable from the
code.

| Decision | Choice |
| --- | --- |
| Nav grouping | Three scope-gated groups + an unlabelled secondary block + user footer (§2) |
| Group labels | **Option A, verbatim** — see §10.1 |
| Documents | One nav item; the page splits into three tables (§2.2) |
| Light/dark theme | **In scope** — Phase 3 (§5) |
| Desktop sidebar | **`collapsible="icon"`** — rails to icons, tooltips mandatory (§3) |
| Command palette | **In scope** — Phase 10 |
| List-state persistence | **In scope** — Phase 6 |
| `useResource` refactor | Deferred to the first change after this plan (§9.1) |
| Hash routing | Deferred (§9.2) |
| Dashboard landing page | Deferred (§9.3) |
| `@tanstack/react-table`, `recharts`, `avatar` | Not adopted (§4) |

### 10.1 Group label wording — Option A

**Resume Fine-Tuning** · **Application Tracking** · **Administration**, Title
Case, with the secondary block (API keys, Security, Account) left unlabelled.

Rejected alternatives were short ("Documents" / "Tracking" / "Admin" /
"Account") and domain-voice ("Fine-Tuning" / "Job Search" / "Administration" /
"Your Access"). Why A:

- **No tautology.** A group label must not restate the name of its only item.
  The short set fails twice — group *Documents* containing the item
  *Documents*, group *Account* containing the item *Account* — and it fails
  worst exactly where the group name is carrying meaning the item name does
  not: a document here *is* a resume/metadata/skill artefact for tuning, which
  "Documents" discards.
- **Matches existing project vocabulary.** "Application tracking" is already
  the README's own section heading, and "fine-tune" matches the
  `fine-tune-resume` skill this API exists to serve. Verbatim is not merely
  literal compliance with the request; it is the wording the rest of the
  project already uses.
- **The unlabelled secondary block is shadcn's own idiom** (`NavSecondary`
  carries no label) and reads correctly — API keys, Security and Account are
  self-evidently personal without a heading announcing it.

Width is a non-issue and should not be relitigated: `SidebarGroupLabel` is
`text-xs font-medium` and renders its string as given — **it does not
uppercase**. A 16rem sidebar leaves ~240px, roughly 36 characters; the longest
label here is 20.

If the labels feel heavy once rendered, the adjustment is casing — drop to
sentence case, "Resume fine-tuning" / "Application tracking" — not shortening.
That keeps the vocabulary and loses the shoutiness. Adding
`uppercase tracking-wider` is the other direction and also fits.
