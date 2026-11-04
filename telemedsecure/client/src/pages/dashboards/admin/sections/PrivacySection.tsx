/**
 * Privacy & Data-Subject Requests.
 *
 * Closes the GDPR loop the rest of the console only audited: here an
 * administrator can actually *fulfil* a request. POST /gdpr/export produces a
 * portability package and POST /gdpr/erasure performs the Art. 17 crypto-shred
 * (the server refuses either unless the caller is the patient or an ADMIN, and
 * refuses erasure outright without `confirmShred`). The ledger below is the
 * registry of completed shreds returned by GET /gdpr/erasure/requests; because
 * the server returns raw rows, the subject name is resolved from the workforce
 * roster this panel already shares.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  FileDown,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserX,
} from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  Field,
  INPUT_CLASS,
  Metric,
  Modal,
  Panel,
  ResourceGate,
  SkeletonGrid,
  SkeletonRows,
} from '../components/ui';
import { selectRows, type ResourceState } from '../hooks/useAdminData';
import type { AdminActions } from '../hooks/useAdminActions';
import { formatDateTime } from '../lib/format';
import type { AdminUser, ErasureRequestEntry } from '../types';

interface PrivacySectionProps {
  erasureRequests: ResourceState;
  users: ResourceState;
  actions: AdminActions;
  onRetry: () => void;
}

const displayName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unnamed subject';

const PrivacySection: React.FC<PrivacySectionProps> = ({ erasureRequests, users, actions, onRetry }) => {
  const erasures = useMemo(() => selectRows<ErasureRequestEntry>(erasureRequests), [erasureRequests.data]);
  const allUsers = useMemo(() => selectRows<AdminUser>(users), [users.data]);

  const patients = useMemo(() => allUsers.filter(u => u.role === 'PATIENT'), [allUsers]);
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    allUsers.forEach(u => map.set(u.id, displayName(u)));
    return map;
  }, [allUsers]);

  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');

  const [exportOpen, setExportOpen] = useState(false);
  const [justification, setJustification] = useState('');
  const [eraseOpen, setEraseOpen] = useState(false);

  const selected = patients.find(p => p.id === subject) ?? null;

  const filteredEasures = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return erasures;
    return erasures.filter(e =>
      (nameById.get(e.userId) ?? e.userId).toLowerCase().includes(needle)
      || (e.reason ?? '').toLowerCase().includes(needle),
    );
  }, [erasures, query, nameById]);

  const runExport = useCallback(() => {
    if (!selected) return;
    void actions.fulfillExport(selected.id, justification.trim() || 'Subject access request (Art. 15).');
    setExportOpen(false);
    setJustification('');
  }, [actions, justification, selected]);

  const runErasure = useCallback(() => {
    if (!selected) return;
    void actions.fulfillErasure(selected.id, 'Right-to-erasure (Art. 17) executed by administrator.');
    setEraseOpen(false);
  }, [actions, selected]);

  return (
    <ResourceGate
      resources={[erasureRequests]}
      onRetry={onRetry}
      skeleton={<div className="space-y-6"><SkeletonGrid cards={4} /><SkeletonRows rows={6} /></div>}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Registered patients" value={patients.length} tone="info" />
        <Metric label="Erasures on record" value={erasures.length} tone={erasures.length ? 'danger' : 'neutral'} />
        <Metric
          label="Keys shredded"
          value={erasures.reduce((acc, e) => acc + (e.recordsShredded || 0), 0)}
          tone="purple"
          hint="Per-record DEKs destroyed"
        />
        <Metric label="Notes shredded" value={erasures.reduce((acc, e) => acc + (e.notesShredded || 0), 0)} tone="warning" />
      </div>

      <Panel
        title="Fulfil a data-subject request"
        icon={ShieldCheck}
        description="Export bundles the subject's records; erasure crypto-shreds their encryption keys irreversibly."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field label="Data subject" className="lg:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select value={subject} onChange={event => setSubject(event.target.value)} aria-label="Select patient" className={`${INPUT_CLASS} pl-8`}>
                <option value="">Choose a patient…</option>
                {patients.map(p => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
              </select>
            </div>
          </Field>
          <div className="flex items-end gap-2 lg:col-span-2">
            <Button variant="secondary" icon={FileDown} disabled={!selected} onClick={() => setExportOpen(true)}>Generate export</Button>
            <Button variant="danger" icon={UserX} disabled={!selected} onClick={() => setEraseOpen(true)}>Erase subject data</Button>
            {selected && (
              <span className="ml-auto self-center text-[11px] text-slate-400">
                Acting on <span className="font-semibold text-slate-200">{displayName(selected)}</span>
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Erasure registry"
        icon={Trash2}
        description="Completed Article 17 crypto-shreds. Newest first."
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search subject or reason" aria-label="Search erasures" className={`${INPUT_CLASS} w-56 pl-8`} />
          </div>
        }
        bodyClassName="p-0"
      >
        {filteredEasures.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={ShieldCheck}
              title={erasures.length === 0 ? 'No erasure requests on record' : 'No request matches this search'}
              description={erasures.length === 0 ? 'Crypto-shreds executed by a patient or administrator appear here.' : 'Try a different term.'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-900/70 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3">Subject</th>
                  <th scope="col" className="px-3 py-3">Shredded</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Records</th>
                  <th scope="col" className="px-3 py-3">Notes</th>
                  <th scope="col" className="px-5 py-3">Vitals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEasures.map(e => (
                  <tr key={e.id} className="align-middle hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-slate-500" />
                        {nameById.get(e.userId) ?? e.userId}
                      </span>
                      {e.reason && <p className="mt-0.5 text-[11px] text-slate-500">{e.reason}</p>}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-400">{formatDateTime(e.shreddedAt)}</td>
                    <td className="px-3 py-3"><Badge tone={e.status === 'COMPLETED' ? 'success' : 'warning'}>{e.status}</Badge></td>
                    <td className="px-3 py-3 text-slate-300">{e.recordsShredded}</td>
                    <td className="px-3 py-3 text-slate-300">{e.notesShredded}</td>
                    <td className="px-5 py-3 text-slate-300">{e.vitalsShredded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Export dialog */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Subject data export"
        description={selected ? `Package every record held for ${displayName(selected)}` : ''}
        icon={FileDown}
        tone="info"
        footer={<><Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button><Button variant="primary" icon={FileDown} busy={selected ? actions.pending === `export:${selected.id}` : false} disabled={!selected} onClick={runExport}>Generate</Button></>}
      >
        <Field label="Justification" hint={<span className="font-mono text-[10px] text-slate-500">Written to the audit trail.</span>}>
          <textarea value={justification} onChange={event => setJustification(event.target.value.slice(0, 280))} rows={4} placeholder="Subject access request under GDPR Article 15." className={`${INPUT_CLASS} resize-y`} />
        </Field>
      </Modal>

      {/* Erasure confirmation */}
      <ConfirmModal
        open={eraseOpen}
        onClose={() => setEraseOpen(false)}
        title="Erase subject data"
        description={selected ? `This irreversibly crypto-shreds the encryption keys for ${displayName(selected)}. The action cannot be undone.` : ''}
        confirmPhrase="ERASE"
        phraseHint="Type ERASE to authorise the irreversible shred"
        busy={selected ? actions.pending === `erasure:${selected.id}` : false}
        onConfirm={runErasure}
      >
        <p className="text-xs text-slate-300">
          Erasure is the platform&rsquo;s right-to-be-forgotten path: record-level keys are destroyed so ciphertext becomes
          unrecoverable, and the shred is logged to the erasure registry above.
        </p>
      </ConfirmModal>
    </ResourceGate>
  );
};

export default React.memo(PrivacySection);
