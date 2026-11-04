/**
 * Finance & Revenue Cycle.
 *
 * Surfaces the three billing endpoints the server already gates on ADMIN —
 * GET /billing/stats, /invoices and /claims — as an operations ledger rather
 * than a static summary. An administrator can settle an outstanding invoice or
 * adjudicate an insurance claim in place; both are chained-audit actions and the
 * row re-pulls over the socket the instant the write lands. The revenue numbers
 * here are computed by the server from real invoices, never modelled.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Landmark,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import ChartBlock from '../components/ChartBlock';
import type { ChartDatum } from '../components/ChartBlock';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  INPUT_CLASS,
  Metric,
  Modal,
  Pagination,
  Panel,
  ResourceGate,
  SkeletonGrid,
  SkeletonRows,
} from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePagedRows } from '../hooks/usePagedRows';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import type { AdminActions } from '../hooks/useAdminActions';
import { csvFileName, downloadCsv, toCsv } from '../lib/csv';
import { formatCurrency } from '../lib/format';
import { handoffBadge } from '../../../../dashboard-shell/handoff';
import type { AdminClaim, AdminInvoice, BillingStats } from '../types';

interface FinanceSectionProps {
  billingStats: ResourceState;
  invoices: ResourceState;
  claims: ResourceState;
  actions: AdminActions;
  onRetry: () => void;
}

const patientName = (p?: { firstName: string | null; lastName: string | null; email: string | null } | null) =>
  p ? [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || '—' : '—';

const invoiceTone = (status: string) =>
  status === 'PAID' ? 'success'
    : status === 'PARTIALLY_PAID' ? 'info'
      : status === 'PENDING' ? 'warning'
        : status === 'REFUNDED' ? 'danger' : 'neutral';

type ClaimTarget = { mode: 'approve' | 'deny'; claim: AdminClaim };

const FinanceSection: React.FC<FinanceSectionProps> = ({ billingStats, invoices, claims, actions, onRetry }) => {
  const stats = billingStats.data as BillingStats | null;
  const invoiceRows = useMemo(() => selectRows<AdminInvoice>(invoices), [invoices.data]);
  const claimRows = useMemo(() => selectRows<AdminClaim>(claims), [claims.data]);

  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('ALL');
  const debouncedInvoice = useDebouncedValue(invoiceQuery, 200);

  const [payTarget, setPayTarget] = useState<AdminInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CREDIT_CARD');

  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimReason, setClaimReason] = useState('');

  const arSeries = useMemo<ChartDatum[]>(() => {
    const ar = stats?.arAging;
    if (!ar) return [];
    return [
      { name: 'Current', value: ar.current, color: '#10b981' },
      { name: '31–60', value: ar.days31to60, color: '#06b6d4' },
      { name: '61–90', value: ar.days61to90, color: '#f59e0b' },
      { name: '90+', value: ar.over90Days, color: '#f43f5e' },
    ];
  }, [stats]);

  const invoiceStatusOptions = useMemo(() => {
    const set = new Set<string>();
    invoiceRows.forEach(i => i.status && set.add(i.status));
    return [...set].sort();
  }, [invoiceRows]);

  const filteredInvoices = useMemo(() => {
    const needle = debouncedInvoice.trim().toLowerCase();
    return invoiceRows.filter(i => {
      if (invoiceStatus !== 'ALL' && i.status !== invoiceStatus) return false;
      if (!needle) return true;
      return i.invoiceNumber.toLowerCase().includes(needle) || patientName(i.patient).toLowerCase().includes(needle);
    });
  }, [invoiceRows, debouncedInvoice, invoiceStatus]);

  const { page, visible, setPage, total } = usePagedRows(filteredInvoices, 10);

  const openPay = useCallback((invoice: AdminInvoice) => {
    setPayAmount(String(invoice.patientDue));
    setPayMethod('CREDIT_CARD');
    setPayTarget(invoice);
  }, []);

  const submitPay = useCallback(() => {
    if (!payTarget) return;
    void actions.settleInvoice(payTarget.id, {
      paymentMethod: payMethod,
      amountPaid: Number(payAmount) || undefined,
    });
    setPayTarget(null);
  }, [actions, payAmount, payMethod, payTarget]);

  const openClaim = useCallback((mode: 'approve' | 'deny', claim: AdminClaim) => {
    setClaimAmount(String(claim.billedAmount));
    setClaimReason('');
    setClaimTarget({ mode, claim });
  }, []);

  const submitClaim = useCallback(() => {
    if (!claimTarget) return;
    if (claimTarget.mode === 'approve') {
      void actions.updateClaim(claimTarget.claim.id, { status: 'APPROVED', approvedAmount: Number(claimAmount) || 0 });
    } else {
      void actions.updateClaim(claimTarget.claim.id, { status: 'DENIED', denialReason: claimReason.trim() || 'Denied by administrator.' });
    }
    setClaimTarget(null);
  }, [actions, claimAmount, claimReason, claimTarget]);

  const exportInvoices = useCallback(() => {
    const csv = toCsv(
      ['Invoice', 'Patient', 'Total', 'Insurance', 'Patient due', 'Status', 'Due'],
      filteredInvoices.map(i => [i.invoiceNumber, patientName(i.patient), i.totalAmount, i.insuranceCovered, i.patientDue, i.status, i.dueDate]),
    );
    downloadCsv(csvFileName('invoices'), csv);
  }, [filteredInvoices]);

  const exportClaims = useCallback(() => {
    const csv = toCsv(
      ['Claim', 'Patient', 'Payer', 'Billed', 'Approved', 'Status'],
      claimRows.map(c => [c.claimNumber, patientName(c.patient), c.payerName, c.billedAmount, c.approvedAmount ?? '', c.status]),
    );
    downloadCsv(csvFileName('claims'), csv);
  }, [claimRows]);

  return (
    <ResourceGate
      resources={[billingStats, invoices, claims]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={6} /><SkeletonRows rows={8} /></div>}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total billed" value={formatCurrency(stats?.summary?.totalBilled)} tone="info" />
        <Metric label="Collected" value={formatCurrency(stats?.summary?.totalCollected)} tone="success" />
        <Metric label="Patient outstanding" value={formatCurrency(stats?.summary?.totalPatientDue)} tone="warning" />
        <Metric label="Insurance covered" value={formatCurrency(stats?.summary?.totalInsuranceCovered)} tone="purple" />
        <Metric label="Pending invoices" value={stats?.summary?.pendingInvoicesCount} tone={stats?.summary?.pendingInvoicesCount ? 'warning' : 'neutral'} />
        <Metric label="Clean claim rate" value={stats?.claimsMetrics?.cleanClaimRate ?? '—'} tone="success" hint={`${stats?.claimsMetrics?.deniedClaims ?? 0} denied`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Receivables aging" icon={Landmark} description="Outstanding patient balances bucketed by invoice age." className="xl:col-span-1">
          <ChartBlock variant="bar" data={arSeries} height={240} emptyLabel="No outstanding receivables" />
        </Panel>

        <Panel title="Pipeline" icon={TrendingUp} description="Invoices and claims across their lifecycle." className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Invoices" value={stats?.summary?.totalInvoices} tone="info" hint={`${stats?.summary?.paidInvoicesCount ?? 0} paid`} />
            <Metric label="Claims filed" value={stats?.claimsMetrics?.totalClaims} tone="purple" />
            <Metric label="Submitted" value={stats?.claimsMetrics?.submittedClaims} tone="info" />
            <Metric label="Approved" value={stats?.claimsMetrics?.approvedClaims} tone="success" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Current (0–30d)" value={formatCurrency(stats?.arAging?.current)} tone="success" />
            <Metric label="31–60 days" value={formatCurrency(stats?.arAging?.days31to60)} tone="info" />
            <Metric label="61–90 days" value={formatCurrency(stats?.arAging?.days61to90)} tone="warning" />
            <Metric label="Over 90 days" value={formatCurrency(stats?.arAging?.over90Days)} tone="danger" />
          </div>
        </Panel>
      </div>

      <Panel
        title="Invoice ledger"
        icon={DollarSign}
        description="Settle an outstanding invoice on a patient's behalf. Every payment is chained-audited."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={invoiceQuery}
                onChange={event => setInvoiceQuery(event.target.value)}
                placeholder="Search invoice or patient"
                aria-label="Search invoices"
                className={`${INPUT_CLASS} w-56 pl-8`}
              />
            </div>
            <select value={invoiceStatus} onChange={event => setInvoiceStatus(event.target.value)} aria-label="Filter invoices" className={`${INPUT_CLASS} w-36`}>
              <option value="ALL">All statuses</option>
              {invoiceStatusOptions.map(s => <option key={s} value={s}>{handoffBadge(s).label}</option>)}
            </select>
            <Button variant="ghost" icon={Download} onClick={exportInvoices} disabled={filteredInvoices.length === 0}>Export</Button>
          </>
        }
        bodyClassName="p-0"
      >
        {filteredInvoices.length === 0 ? (
          <div className="px-5 py-8"><EmptyState icon={FileText} title="No invoices" description="No invoice matches this view yet." /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Invoice</th>
                    <th scope="col" className="px-3 py-3">Patient</th>
                    <th scope="col" className="px-3 py-3">Total</th>
                    <th scope="col" className="px-3 py-3">Patient due</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map(inv => {
                    const settleable = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.status !== 'REFUNDED';
                    return (
                      <tr key={inv.id} className="align-middle hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-300">{inv.invoiceNumber}</td>
                        <td className="px-3 py-3 text-slate-200">{patientName(inv.patient)}</td>
                        <td className="px-3 py-3 text-slate-300">{formatCurrency(inv.totalAmount)}</td>
                        <td className="px-3 py-3 text-slate-300">{formatCurrency(inv.patientDue)}</td>
                        <td className="px-3 py-3"><Badge tone={invoiceTone(inv.status)}>{handoffBadge(inv.status).label}</Badge></td>
                        <td className="px-5 py-3 text-right">
                          {settleable ? (
                            <Button variant="primary" icon={CreditCard} onClick={() => openPay(inv)} disabled={actions.pending === `pay:${inv.id}`}>Settle</Button>
                          ) : (
                            <span className="text-[11px] text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={10} total={total} onPage={setPage} />
          </>
        )}
      </Panel>

      <Panel
        title="Insurance claims"
        icon={ShieldAlert}
        description="Approve or deny submitted claims. Approving re-splits the invoice between payer and patient."
        actions={<Button variant="ghost" icon={Download} onClick={exportClaims} disabled={claimRows.length === 0}>Export</Button>}
        bodyClassName="p-0"
      >
        {claimRows.length === 0 ? (
          <div className="px-5 py-8"><EmptyState icon={ShieldAlert} title="No claims on file" description="No insurance claims have been generated." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3">Claim</th>
                  <th scope="col" className="px-3 py-3">Patient</th>
                  <th scope="col" className="px-3 py-3">Payer</th>
                  <th scope="col" className="px-3 py-3">Billed</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Adjudicate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {claimRows.slice(0, 25).map(claim => {
                  const decidable = claim.status !== 'APPROVED' && claim.status !== 'DENIED' && claim.status !== 'SETTLED';
                  return (
                    <tr key={claim.id} className="align-middle hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-300">{claim.claimNumber}</td>
                      <td className="px-3 py-3 text-slate-200">{patientName(claim.patient)}</td>
                      <td className="px-3 py-3 text-slate-300">{claim.payerName}</td>
                      <td className="px-3 py-3 text-slate-300">{formatCurrency(claim.billedAmount)}</td>
                      <td className="px-3 py-3"><Badge tone={handoffBadge(claim.status).tone}>{handoffBadge(claim.status).label}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {decidable ? (
                            <>
                              <button onClick={() => openClaim('approve', claim)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500">Approve</button>
                              <button onClick={() => openClaim('deny', claim)} className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition hover:border-rose-500/60 hover:text-rose-200">Deny</button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-500">{claim.approvedAmount != null ? formatCurrency(claim.approvedAmount) : 'Closed'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Settle invoice */}
      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title="Record payment"
        description={payTarget ? `${payTarget.invoiceNumber} · ${patientName(payTarget.patient)}` : ''}
        icon={CreditCard}
        tone="success"
        footer={<><Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button><Button variant="primary" icon={CreditCard} onClick={submitPay} busy={!!payTarget && actions.pending === `pay:${payTarget.id}`}>Settle</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount paid" required hint={payTarget ? <span className="font-mono text-[10px] text-slate-500">Due {formatCurrency(payTarget.patientDue)}</span> : undefined}>
            <input type="number" min={0} step="0.01" value={payAmount} onChange={event => setPayAmount(event.target.value)} className={`${INPUT_CLASS} font-mono`} />
          </Field>
          <Field label="Method">
            <select value={payMethod} onChange={event => setPayMethod(event.target.value)} className={INPUT_CLASS}>
              <option value="CREDIT_CARD">Credit card</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="INSURANCE">Insurance</option>
            </select>
          </Field>
        </div>
      </Modal>

      {/* Adjudicate claim */}
      <Modal
        open={!!claimTarget}
        onClose={() => setClaimTarget(null)}
        title={claimTarget?.mode === 'approve' ? 'Approve claim' : 'Deny claim'}
        description={claimTarget ? `${claimTarget.claim.claimNumber} · ${patientName(claimTarget.claim.patient)}` : ''}
        icon={claimTarget?.mode === 'approve' ? TrendingUp : ShieldAlert}
        tone={claimTarget?.mode === 'approve' ? 'success' : 'danger'}
        footer={<><Button variant="ghost" onClick={() => setClaimTarget(null)}>Cancel</Button><Button variant={claimTarget?.mode === 'approve' ? 'success' : 'danger'} onClick={submitClaim}>Confirm</Button></>}
      >
        {claimTarget?.mode === 'approve' ? (
          <Field label="Approved amount" required hint={<span className="font-mono text-[10px] text-slate-500">Billed {formatCurrency(claimTarget.claim.billedAmount)}</span>}>
            <input type="number" min={0} step="0.01" value={claimAmount} onChange={event => setClaimAmount(event.target.value)} className={`${INPUT_CLASS} font-mono`} />
          </Field>
        ) : (
          <Field label="Denial reason" required>
            <textarea value={claimReason} onChange={event => setClaimReason(event.target.value.slice(0, 280))} rows={4} placeholder="Reason communicated back to the billing office." className={`${INPUT_CLASS} resize-y`} />
          </Field>
        )}
      </Modal>
    </ResourceGate>
  );
};

export default React.memo(FinanceSection);
