/**
 * Staff onboarding dialog with the two paths the server actually exposes:
 *
 *  - provision: create the identity now, hand back a strong temporary password
 *    (generated server-side unless the operator supplies one);
 *  - invite: issue a single-use activation token whose expiry the server decides
 *    and returns, so this dialog never claims "5 minutes" when the deployment
 *    default is 60.
 *
 * The credential that comes back is shown through `SecretField`, masked until
 * revealed. The previous implementation wrote the temporary password into a
 * toast — a transient popup is not a safe carrier for a first-factor secret.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Mail, ShieldCheck, UserPlus } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  INPUT_CLASS,
  Modal,
  SecretField,
} from '../components/ui';
import type { AdminActions, InvitationResult, ProvisionResult } from '../hooks/useAdminActions';
import { PROVISIONABLE_ROLES, type UserRole } from '../types';

const LICENSED_ROLES: UserRole[] = ['DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'RADIOLOGIST'];

const EXPIRY_CHOICES = [
  { hours: 1, label: '1 hour' },
  { hours: 4, label: '4 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
];

interface ProvisionStaffModalProps {
  open: boolean;
  onClose: () => void;
  actions: AdminActions;
}

const ProvisionStaffModal: React.FC<ProvisionStaffModalProps> = ({ open, onClose, actions }) => {
  const [mode, setMode] = useState<'provision' | 'invite'>('provision');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('DOCTOR');
  const [licenseNo, setLicenseNo] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [password, setPassword] = useState('');
  const [expiryHours, setExpiryHours] = useState(1);

  const [issued, setIssued] = useState<{ kind: 'provision'; data: ProvisionResult } | { kind: 'invite'; data: InvitationResult } | null>(null);

  const requiresLicense = LICENSED_ROLES.includes(role);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit =
    emailValid &&
    (mode === 'invite' || (firstName.trim().length > 0 && lastName.trim().length > 0)) &&
    (mode !== 'provision' || password.trim() === '' || password.trim().length >= 8);

  const reset = useCallback(() => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setLicenseNo('');
    setJurisdiction('');
    setSpecialty('');
    setPassword('');
    setIssued(null);
  }, []);

  const dismiss = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    if (mode === 'provision') {
      const result = await actions.provisionStaff({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        ...(password.trim() ? { password: password.trim() } : {}),
        ...(requiresLicense && licenseNo.trim() ? { medicalLicenseNo: licenseNo.trim() } : {}),
        ...(requiresLicense && jurisdiction.trim() ? { licenseJurisdiction: jurisdiction.trim() } : {}),
        ...(requiresLicense && specialty.trim() ? { specialty: specialty.trim() } : {}),
      });
      if (result.ok && result.data) setIssued({ kind: 'provision', data: result.data as ProvisionResult });
      return;
    }
    const result = await actions.createInvitation({ email: email.trim(), role, expiresInHours: expiryHours });
    if (result.ok && result.data) setIssued({ kind: 'invite', data: result.data as InvitationResult });
  }, [actions, canSubmit, email, expiryHours, firstName, jurisdiction, lastName, licenseNo, mode, password, requiresLicense, role, specialty]);

  const pendingLabel = mode === 'provision' ? 'provision' : 'invitation';
  const busy = actions.pending === pendingLabel;

  const roleHint = useMemo(
    () => PROVISIONABLE_ROLES.find(option => option.value === role)?.label ?? role,
    [role],
  );

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="Onboard clinical staff"
      description="Provision an account directly, or issue a single-use activation link the invitee sets a password with."
      icon={UserPlus}
      tone="purple"
      size="lg"
      footer={
        issued ? (
          <>
            <Button variant="ghost" onClick={reset}>Onboard another</Button>
            <Button variant="primary" onClick={dismiss}>Close</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={dismiss} disabled={busy}>Cancel</Button>
            <Button variant="primary" icon={busy ? undefined : mode === 'provision' ? ShieldCheck : Mail} busy={busy} disabled={!canSubmit} onClick={() => void submit()}>
              {mode === 'provision' ? 'Create account' : 'Issue invitation'}
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <div className="space-y-4">
          <Badge tone="success">
            {issued.kind === 'provision' ? 'ACCOUNT PROVISIONED' : 'INVITATION ISSUED'} · {roleHint}
          </Badge>

          {issued.kind === 'provision' ? (
            <>
              <p className="text-xs text-slate-300">
                {issued.data.name} can sign in as <strong className="text-white">{issued.data.email}</strong> with the
                temporary credential below. Treat it as a shared secret until they change it.
              </p>
              <SecretField label="Temporary password" value={issued.data.temporaryPassword} />
            </>
          ) : (
            <>
              <p className="text-xs text-slate-300">
                Activation link for <strong className="text-white">{issued.data.email}</strong>. It is valid for
                {' '}{issued.data.expiresInMinutes} minute(s) as decided by the server, and only this one copy of the
                token exists — the database stores its hash.
              </p>
              <SecretField label="Activation link" value={issued.data.link} mono />
            </>
          )}

          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200">
            Copy this into your ticketing system or an out-of-band channel now. This console does not retain the
            credential or the token after the dialog closes.
          </p>
        </div>
      ) : (
        <>
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-0.5">
            {(['provision', 'invite'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className={`flex-1 rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
                  mode === option ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {option === 'provision' ? 'Direct provisioning' : 'Invitation link'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Given name" required={mode === 'provision'}>
              <input value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="off" className={INPUT_CLASS} disabled={mode === 'invite'} />
            </Field>
            <Field label="Family name" required={mode === 'provision'}>
              <input value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="off" className={INPUT_CLASS} disabled={mode === 'invite'} />
            </Field>
            <Field label="Work email" required hint={email && !emailValid ? <span className="text-red-400">Invalid address</span> : undefined}>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                type="email"
                autoComplete="off"
                placeholder="name@hospital.org"
                className={`${INPUT_CLASS} sm:col-span-1`}
              />
            </Field>
            <Field label="Role" required>
              <select value={role} onChange={event => setRole(event.target.value as UserRole)} className={INPUT_CLASS}>
                {PROVISIONABLE_ROLES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {mode === 'provision' && (
            <>
              <Field
                label="Initial password"
                hint={<span className="font-mono text-[10px] text-slate-500">leave blank to auto-generate</span>}
              >
                <input
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  minLength={8}
                  placeholder="At least 8 characters, or blank"
                  className={`${INPUT_CLASS} font-mono`}
                />
              </Field>
              <p className="-mt-2 text-[11px] text-slate-500">
                Blank is recommended: the server generates a 12-byte random credential you never have to invent.
              </p>
            </>
          )}

          {mode === 'invite' && (
            <Field label="Invitation validity">
              <select value={expiryHours} onChange={event => setExpiryHours(Number(event.target.value))} className={INPUT_CLASS}>
                {EXPIRY_CHOICES.map(option => (
                  <option key={option.hours} value={option.hours}>{option.label}</option>
                ))}
              </select>
            </Field>
          )}

          {requiresLicense && mode === 'provision' && (
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4 sm:grid-cols-3">
              <Field label="Licence number">
                <input value={licenseNo} onChange={event => setLicenseNo(event.target.value)} className={`${INPUT_CLASS} font-mono`} />
              </Field>
              <Field label="Jurisdiction">
                <input value={jurisdiction} onChange={event => setJurisdiction(event.target.value)} placeholder="e.g. DE, CA" className={INPUT_CLASS} />
              </Field>
              <Field label="Specialty">
                <input value={specialty} onChange={event => setSpecialty(event.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500">
            {mode === 'provision'
              ? 'Directly provisioned accounts are marked credential-VERIFIED because an administrator attested to their identity. Self-registered staff land in the credential review queue instead.'
              : 'The invitee sets their own password after activation, so no credential transits this console.'}
          </p>
        </>
      )}
    </Modal>
  );
};

export default React.memo(ProvisionStaffModal);
