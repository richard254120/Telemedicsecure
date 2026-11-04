/**
 * Re-export shim. The presentational primitives were promoted to the shared
 * `dashboard-shell` module. This keeps the admin console's existing
 * `../components/ui` imports (Button, Panel, Modal, ToastViewport, ...) working.
 */
export * from '../../../../dashboard-shell/ui';
