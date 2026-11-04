/**
 * Administrative & Forensics Control Center — entry component.
 *
 * This file used to be a single 3,265-line component holding 40+ `useState`
 * hooks, ten hand-inlined `fetch` calls, seven tab bodies and five modals. It is
 * now a thin orchestrator: the data layer lives in `admin/hooks`, the presentation
 * primitives in `admin/components`, each panel in `admin/sections` behind
 * `React.lazy`, and each dialog in `admin/modals`.
 *
 * Responsibilities left here:
 *  - keep the active panel in the URL so a tab is shareable and survives reload;
 *  - ask the resource store for exactly the endpoints the active panel reads;
 *  - own the session-expiry gate and the cross-panel dialogs.
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, FileSearch, LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Shell from '../../dashboard-shell/Shell';
import { ADMIN_NAV, isAdminSectionId, type AdminSectionId } from '../../dashboard-shell/navConfig';
import { Button, SkeletonGrid, SkeletonRows, ToastViewport } from './admin/components/ui';
import { AUTH_EXPIRED_EVENT } from './admin/api';
import { selectRows, useAdminData, type ResourceKey } from './admin/hooks/useAdminData';
import { useAdminActions, type ActionResult } from './admin/hooks/useAdminActions';
import { useToast } from './admin/hooks/useToast';
import { useAdminLive } from './admin/hooks/useAdminLive';
import type { AdminConsultation, AdminInvoice, AdminUser, ComplianceViolation, ErasureRequestEntry, Incident, PrescriptionAudit, SystemStats } from './admin/types';

/* Panels and heavy dialogs are code-split: opening the console no longer pulls
 * the SMS ledger, the EPCS registry or recharts into the first paint. */
const OverviewSection = lazy(() => import('./admin/sections/OverviewSection'));
const ComplianceSection = lazy(() => import('./admin/sections/ComplianceSection'));
const IncidentsSection = lazy(() => import('./admin/sections/IncidentsSection'));
const PrescriptionsSection = lazy(() => import('./admin/sections/PrescriptionsSection'));
const WorkforceSection = lazy(() => import('./admin/sections/WorkforceSection'));
const PatientsSection = lazy(() => import('./admin/sections/PatientsSection'));
const SmsSection = lazy(() => import('./admin/sections/SmsSection'));
const ConsultationSection = lazy(() => import('./admin/sections/ConsultationSection'));
const FinanceSection = lazy(() => import('./admin/sections/FinanceSection'));
const PrivacySection = lazy(() => import('./admin/sections/PrivacySection'));
const ProvisionStaffModal = lazy(() => import('./admin/modals/ProvisionStaffModal'));
const AuditorDossierModal = lazy(() => import('./admin/modals/AuditorDossierModal'));
const TwoFactorSetupModal = lazy(() =>
  import('../../components/TwoFactorSetupModal').then(mod => ({ default: mod.TwoFactorSetupModal })),
);
const PrescriptionDocumentModal = lazy(() =>
  import('../../components/PrescriptionDocumentModal').then(mod => ({ default: mod.PrescriptionDocumentModal })),
);

/** Which endpoints a panel actually renders. Nothing is fetched off-screen. */
const TAB_RESOURCES: Record<AdminSectionId, ResourceKey[]> = {
  overview: ['stats', 'chain'],
  compliance: ['violations', 'alerts', 'chain'],
  investigation: ['incidents', 'alerts'],
  prescriptions: ['prescriptions'],
  users: ['users', 'invitations'],
  patients: ['users'],
  sms: ['smsLogs', 'smsStatus'],
  consultations: ['consultations', 'stats'],
  finance: ['billingStats', 'invoices', 'claims'],
  privacy: ['erasureRequests', 'users'],
};

const DOSSIER_RESOURCES: ResourceKey[] = ['users', 'violations', 'alerts', 'chain', 'stats'];

const PANEL_FALLBACK = (
  <div className="space-y-6">
    <SkeletonGrid cards={4} />
    <SkeletonRows rows={7} />
  </div>
);

function initialTab(value: string | null): AdminSectionId {
  return isAdminSectionId(value) ? value : 'overview';
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout, getAuthHeaders } = useAuth();

  // `getAuthHeaders` is a `useCallback` on the token inside AuthContext, so it
  // keeps a stable identity between renders. That stability is what lets the
  // memoised panels below skip re-rendering; the data and action layers take it
  // directly instead of through a ref (writing a ref during render is not
  // concurrent-safe).
  const { toast, notify, dismiss } = useToast();
  const data = useAdminData(getAuthHeaders);
  const { state, ensure, refresh, reset, isBusy, lastSyncedAt } = data;

  const actions = useAdminActions({ getAuthHeaders, notify, refresh });

  const [provisionOpen, setProvisionOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [documentRx, setDocumentRx] = useState<PrescriptionAudit | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const activeTab = initialTab(searchParams.get('tab'));

  /* Fetch only what the visible panel needs; `ensure` is a no-op for warm keys. */
  useEffect(() => {
    ensure(TAB_RESOURCES[activeTab]);
  }, [activeTab, ensure]);

  /* Real-time: a server ops-event (booking, payment, claim, erasure) re-pulls
   * exactly the resources of whichever panel is mounted right now. The active tab
   * is mirrored in a ref so the socket subscribes once, not on every tab change. */
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const onLiveEvent = useCallback(() => {
    void refresh(TAB_RESOURCES[activeTabRef.current]);
  }, [refresh]);
  const live = useAdminLive(user?.id, user?.role, onLiveEvent);

  const selectTab = useCallback((tab: AdminSectionId) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  /* A 401/403 from any endpoint means the token is gone. Cached PHI is dropped
   * and the operator is gated rather than left reading a stale console. */
  useEffect(() => {
    const onExpired = () => {
      setSessionExpired(current => {
        if (!current) {
          notify('Your session is no longer valid. Re-authenticate to continue.', 'error', 0);
          reset();
        }
        return true;
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [notify, reset]);

  const refreshActive = useCallback(() => {
    if (sessionExpired) {
      notify('Re-authenticate before refreshing.', 'error');
      return;
    }
    void refresh();
  }, [notify, refresh, sessionExpired]);

  const reverifyChain = useCallback(() => {
    void refresh(['chain']);
  }, [refresh]);

  const onRetryAll = useCallback(() => {
    if (sessionExpired) return;
    void refresh(TAB_RESOURCES[activeTab]);
  }, [activeTab, refresh, sessionExpired]);

  const openProvision = useCallback(() => setProvisionOpen(true), []);

  const closeProvision = useCallback(() => setProvisionOpen(false), []);

  const openDossier = useCallback(() => {
    ensure(DOSSIER_RESOURCES);
    setDossierOpen(true);
  }, [ensure]);

  const closeDossier = useCallback(() => setDossierOpen(false), []);

  const openTwoFactor = useCallback(() => setTwoFactorOpen(true), []);
  const closeTwoFactor = useCallback(() => setTwoFactorOpen(false), []);

  const signOut = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const openCalendar = useCallback(() => navigate('/calendar'), [navigate]);

  const openDocument = useCallback((row: PrescriptionAudit) => setDocumentRx(row), []);
  const closeDocument = useCallback(() => setDocumentRx(null), []);

  // Attribution strings come from the signed-in record. A profile without names
  // (a staff account created before the directory carried them) falls back to
  // the email rather than rendering "undefined undefined" into an audit note.
  const operatorName = useMemo(() => {
    if (!user) return 'Administrator';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email;
  }, [user]);

  const resolveViolation = useCallback(
    (violationId: string, note?: string): Promise<ActionResult> =>
      actions.closeViolation(violationId, user?.email ?? 'administrator', note),
    [actions, user?.email],
  );

  const counts = useMemo(() => {
    const violations = selectRows<ComplianceViolation>(state.violations);
    const roster = selectRows<AdminUser>(state.users);
    const incidents = selectRows<Incident>(state.incidents);
    const prescriptions = selectRows<PrescriptionAudit>(state.prescriptions);
    const smsLogs = selectRows<{ status: string }>(state.smsLogs);
    const consultations = selectRows<AdminConsultation>(state.consultations);
    const invoices = selectRows<AdminInvoice>(state.invoices);
    const erasures = selectRows<ErasureRequestEntry>(state.erasureRequests);
    const stats = state.stats.data as SystemStats | null;

    return {
      overview: { value: stats?.overview?.totalUsers ?? 0, status: state.stats.status },
      compliance: { value: violations.filter(item => !item.resolved).length, status: state.violations.status },
      investigation: { value: incidents.filter(item => item.status !== 'CLOSED').length, status: state.incidents.status },
      prescriptions: { value: prescriptions.filter(item => item.signatureStatus === 'TAMPERED').length, status: state.prescriptions.status },
      users: { value: roster.filter(item => item.verificationStatus === 'PENDING_REVIEW').length, status: state.users.status },
      patients: { value: roster.filter(item => item.role === 'PATIENT').length, status: state.users.status },
      consultations: { value: consultations.filter(item => item.status === 'PENDING').length, status: state.consultations.status },
      finance: { value: invoices.filter(item => item.status === 'PENDING' || item.status === 'PARTIALLY_PAID').length, status: state.invoices.status },
      privacy: { value: erasures.length, status: state.erasureRequests.status },
      sms: { value: smsLogs.filter(log => log.status === 'FAILED').length, status: state.smsLogs.status },
    } as Record<AdminSectionId, { value: number; status: typeof state.stats.status }>;
  }, [state]);

  const panel = sessionExpired ? (
    <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300">
        <LockKeyhole className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-black text-white">Session credentials no longer valid</h2>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-300">
        The API rejected this session, so every cached roster, prescription and audit payload has been discarded from
        this view rather than left on screen. Sign in again to reload the console with fresh, attributed access.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="primary" icon={LogIn} onClick={signOut}>Return to sign-in</Button>
      </div>
    </section>
  ) : (
    <Suspense fallback={PANEL_FALLBACK}>
      {activeTab === 'overview' && (
        <OverviewSection stats={state.stats} chain={state.chain} onRetry={onRetryAll} />
      )}
      {activeTab === 'compliance' && (
        <ComplianceSection
          violations={state.violations}
          alerts={state.alerts}
          chain={state.chain}
          operatorName={operatorName}
          onRetry={onRetryAll}
          onReverify={reverifyChain}
          onResolve={resolveViolation}
        />
      )}
      {activeTab === 'investigation' && (
        <IncidentsSection
          incidents={state.incidents}
          alerts={state.alerts}
          actions={actions}
          operatorEmail={user?.email ?? 'administrator'}
          onRetry={onRetryAll}
        />
      )}
      {activeTab === 'prescriptions' && (
        <PrescriptionsSection prescriptions={state.prescriptions} onRetry={onRetryAll} onOpenDocument={openDocument} />
      )}
      {activeTab === 'users' && (
        <WorkforceSection
          users={state.users}
          invitations={state.invitations}
          actions={actions}
          operatorId={user?.id ?? ''}
          onRetry={onRetryAll}
          onOpenProvision={openProvision}
        />
      )}
      {activeTab === 'patients' && (
        <PatientsSection users={state.users} actions={actions} onRetry={onRetryAll} />
      )}
      {activeTab === 'sms' && (
        <SmsSection smsLogs={state.smsLogs} smsStatus={state.smsStatus} actions={actions} onRetry={onRetryAll} />
      )}
      {activeTab === 'consultations' && (
        <ConsultationSection consultations={state.consultations} actions={actions} onRetry={onRetryAll} />
      )}
      {activeTab === 'finance' && (
        <FinanceSection billingStats={state.billingStats} invoices={state.invoices} claims={state.claims} actions={actions} onRetry={onRetryAll} />
      )}
      {activeTab === 'privacy' && (
        <PrivacySection erasureRequests={state.erasureRequests} users={state.users} actions={actions} onRetry={onRetryAll} />
      )}
    </Suspense>
  );

  const headerActions = (
    <>
      <span
        title={live.connected ? 'Live updates connected over the console socket' : 'Reconnecting to the live feed'}
        className="hidden items-center gap-1.5 rounded-xl border border-slate-600/40 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 sm:inline-flex"
      >
        <span className={`h-2 w-2 rounded-full ${live.connected ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />
        {live.connected ? 'LIVE' : 'CONNECTING'}
      </span>
      <Button variant="secondary" icon={Calendar} onClick={openCalendar} className="hidden sm:inline-flex">
        Calendar
      </Button>
      <Button variant="success" icon={FileSearch} onClick={openDossier} title="HIPAA §164.312 audit dossier">
        Audit Dossier
      </Button>
      <Button variant="primary" icon={UserPlus} onClick={openProvision}>
        Provision Staff
      </Button>
    </>
  );

  return (
    <>
      <Shell
        user={user}
        nav={ADMIN_NAV}
        accent="purple"
        brandTitle="TeleMedSecure"
        brandSubtitle="Admin Console"
        activeTab={activeTab}
        onSelectTab={id => selectTab(id as AdminSectionId)}
        counts={counts}
        lastSyncedAt={lastSyncedAt}
        isRefreshing={isBusy}
        sessionExpired={sessionExpired}
        onRefresh={refreshActive}
        headerActions={headerActions}
        onOpenTwoFactor={openTwoFactor}
        onSignOut={signOut}
        mainId="admin-main"
      >
        {panel}
      </Shell>

      <Suspense fallback={null}>
        {provisionOpen && (
          <ProvisionStaffModal open={provisionOpen} onClose={closeProvision} actions={actions} />
        )}
        {dossierOpen && (
          <AuditorDossierModal
            open={dossierOpen}
            onClose={closeDossier}
            operator={user ? { email: user.email, name: operatorName, role: user.role } : null}
            users={state.users}
            violations={state.violations}
            alerts={state.alerts}
            chain={state.chain}
            stats={state.stats}
          />
        )}
        {documentRx && (
          <PrescriptionDocumentModal prescription={documentRx} onClose={closeDocument} />
        )}
        {twoFactorOpen && (
          <TwoFactorSetupModal isOpen onClose={closeTwoFactor} />
        )}
      </Suspense>

      <ToastViewport toast={toast} onDismiss={dismiss} />
    </>
  );
};

export default AdminDashboard;
