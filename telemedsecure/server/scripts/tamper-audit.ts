import { PrismaClient } from '@prisma/client';
import { verifyAuditChainAndMerkle } from '../src/services/audit.service';

const prisma = new PrismaClient();

async function main() {
  console.log('--- TeleMedSecure: AuditEvent Database Tamper Simulation Script ---');

  // 1. Check current verification state before tampering
  console.log('\n[Step 1] Checking audit chain before tampering...');
  const beforeReport = await verifyAuditChainAndMerkle();
  console.log(`Current Status: ${beforeReport.status} (Valid: ${beforeReport.isValid}, Events: ${beforeReport.totalEvents})`);

  // 2. Fetch the target audit event to tamper with
  const events = await prisma.auditEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });

  if (events.length === 0) {
    console.error('No audit events found in database! Please perform some actions first.');
    process.exit(1);
  }

  // Pick an event in the middle or the latest
  const target = events.length > 1 ? events[1] : events[0];
  console.log(`\n[Step 2] Selected AuditEvent for tampering:`);
  console.log(`  ID:        ${target.id}`);
  console.log(`  Action:    ${target.action}`);
  console.log(`  Resource:  ${target.resource}`);
  console.log(`  Hash:      ${target.hash}`);
  console.log(`  PrevHash:  ${target.prevHash}`);

  // 3. Perform unauthorized row modification directly in the database
  const tamperedAction = `${target.action}_UNAUTHORIZED_TAMPER_MODIFIED`;
  console.log(`\n[Step 3] Modifying DB row directly: "${target.action}" -> "${tamperedAction}"...`);

  await prisma.auditEvent.update({
    where: { id: target.id },
    data: {
      action: tamperedAction
      // NOTE: We do NOT recompute target.hash or update subsequent prevHashes!
      // This simulates an insider SQL injection, rogue DB admin, or unauthorized modification.
    }
  });

  console.log('✓ Database row altered successfully without updating hash chain.');

  // 4. Run verification to demonstrate detection
  console.log('\n[Step 4] Running Audit Chain & Merkle Verification job...');
  const afterReport = await verifyAuditChainAndMerkle();

  console.log('\n======================================================');
  console.log(`DETECTION RESULT: ${afterReport.status}`);
  console.log(`Chain Intact:     ${afterReport.chainIntact ? 'YES' : 'NO'}`);
  console.log(`Integrity Valid:  ${afterReport.isValid ? 'YES' : 'NO'}`);
  if (afterReport.brokenEvent) {
    console.log(`\nDetected Tampering at Event Index #${afterReport.brokenEvent.index}:`);
    console.log(`  Event ID:       ${afterReport.brokenEvent.id}`);
    console.log(`  Reason:         ${afterReport.brokenEvent.reason}`);
    console.log(`  Expected Hash:  ${afterReport.brokenEvent.expectedHash}`);
    console.log(`  Stored Hash:    ${afterReport.brokenEvent.actualHash}`);
  }
  console.log('======================================================\n');
  console.log('To view this in your browser or test via API:');
  console.log('  curl http://localhost:4000/api/v1/integrity/verify\n');
  console.log('To repair the chain after your demo:');
  console.log('  curl -X POST http://localhost:4000/api/v1/integrity/repair\n');
}

main()
  .catch(err => {
    console.error('Error running tamper script:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
