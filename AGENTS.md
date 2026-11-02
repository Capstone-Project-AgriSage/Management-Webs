# Frontend conventions

- Preserve the existing React feature folders, API clients, permissions and shared UI components.
- Management-table row actions use `components/ui/RowActionsMenu.tsx` (the `⋮` ActionMenu) by default,
  even if only one action is available. Do not introduce inline text actions or icon strips for these rows.
- Put actions in the final right-aligned cell. Give each trigger an accessible label naming its record.
- Keep permission checks, status conditions, disabled/busy states, confirmations and existing handlers.
- Destructive actions go last, separated from ordinary actions. Do not hide the trigger only on hover.
- Row/name links may remain shortcuts; they do not replace an accessible action menu for record management.
- Exceptions: editable line-item forms (quantity inputs/add/remove), page-level toolbars, report tables with
  no row actions, and popup footer buttons. Do not force these controls into a record action menu.
- Reuse ListToolbar, StatusBadge, pagination and modal components; avoid unrelated visual/backend changes.
- Validate TypeScript (`npx tsc -b --pretty false`), build and lint after frontend changes.
