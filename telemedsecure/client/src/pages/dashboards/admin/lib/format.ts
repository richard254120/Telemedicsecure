/**
 * Re-export shim. The presentation/format helpers were promoted to the
 * role-agnostic `dashboard-shell` module so every station shares one set.
 * This shim keeps the admin console's existing `../lib/format` imports working.
 */
export * from '../../../../dashboard-shell/format';
