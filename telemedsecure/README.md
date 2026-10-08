# TeleMedSecure: Zero-Knowledge Medical Platform

[![Security: HIPAA & GDPR Compliant](https://img.shields.io/badge/Security-HIPAA%20%26%20GDPR%20Ready-blue.svg)](#threat-model)
[![Cryptography: AES-256 & Ed25519](https://img.shields.io/badge/Cryptography-AES--256--GCM%20%7C%20Ed25519-emerald.svg)](#cryptographic-architecture)
[![Blockchain: Solidity Merkle Anchor](https://img.shields.io/badge/Blockchain-Ethereum%20Audit%20Anchor-purple.svg)](#blockchain-audit-anchoring)
[![Tests: 100% Passing](https://img.shields.io/badge/Tests-Passing%20(47%2F47)-brightgreen.svg)](#testing--verification)

**TeleMedSecure** is an enterprise-grade, zero-knowledge telemedicine platform engineered for end-to-end encrypted consultations, cryptographic clinical vitals, DEA EPCS-compliant digitally signed prescriptions, immutable blockchain-anchored audit trails, and automated forensic incident reporting.

---

## Architecture Diagram

```
 +-----------------------------------------------------------------------------------------+
 |                                  CLIENT BROWSER (Vite / React)                          |
 |  +--------------------+  +--------------------+  +-------------------+  +-------------+  |
 |  |  Doctor Dashboard  |  |  Patient Dashboard |  |  Nursing Station  |  | Admin & CC0 |  |
 |  +--------------------+  +--------------------+  +-------------------+  +-------------+  |
 |            |                       |                       |                   |         |
 |   [ECDH P-256 Key Exchange]        |                       |                   |         |
 |   [WebRTC Insertable Streams]      |                       |                   |         |
 +------------|-----------------------|-----------------------|-------------------|---------+
              | (E2EE Audio/Video)    |                       |                   |
              v                       v                       v                   v
 +-----------------------------------------------------------------------------------------+
 |                               EXPRESS API & WEBSOCKET GATEWAY                           |
 |                                                                                         |
 |  • RBAC & Session Auth        • Envelope Encryption Engine    • Ed25519 Signature Verifier |
 |  • Socket.IO Realtime Push    • Compliance Rules Engine (9)   • Merkle Anchor Scheduler |
 +-----------------------------------------------------------------------------------------+
              |                                               |
              | (SQL Queries)                                 | (anchorRoot / isRootAnchored)
              v                                               v
 +----------------------------------------+       +----------------------------------------+
 |          POSTGRESQL DATABASE           |       |      ETHEREUM BLOCKCHAIN (Hardhat)     |
 |                                        |       |                                        |
 |  • Users & RBAC Roles                  |       |  • Smart Contract: AuditAnchor.sol     |
 |  • Encrypted Notes & Vitals (DEKs)     |       |  • Merkle Root Verification            |
 |  • Ed25519 Signed Prescriptions        |       |  • Immutable PDF Forensic Hashes       |
 |  • SHA-256 Hash-Chained AuditEvents    |       |  • Non-Repudiation Proofs              |
 +----------------------------------------+       +----------------------------------------+
```

---

## Cryptographic Architecture

### 1. Zero-Knowledge E2EE Video Consultations
- **Key Negotiation**: Ephemeral Elliptic Curve Diffie-Hellman (**ECDH P-256**) key exchange negotiated directly between doctor and patient peers over secure signaling channels.
- **Media Frame Encryption**: WebRTC Insertable Streams encrypt audio and video packets frame-by-frame using **AES-GCM**.
- **Server Blindness**: The central relay server functions strictly as an untrusted media router (SFU) and possesses zero access to plaintext frames or session decryption keys.

### 2. Envelope Encryption (AES-256-GCM + Ephemeral DEKs)
- Sensitive Protected Health Information (**PHI**)—including clinical notes, diagnoses, and vital signs—is sealed via envelope encryption.
- **Data Encryption Key (DEK)**: A unique, cryptographically random 256-bit key is generated per database row.
- Plaintext payload is encrypted with the DEK using AES-256-GCM (generating a 96-bit random IV and a 128-bit authentication tag).
- The DEK is encrypted with a master Key Encryption Key (**KEK**) and stored alongside the ciphertext.

### 3. DEA EPCS Ed25519 Digital Signatures
- Complies with DEA Electronic Prescriptions for Controlled Substances (**EPCS, 21 CFR §1311**).
- Each doctor possesses an **Ed25519** keypair. The private key is encrypted with an Argon2id/PBKDF2 key derived from the doctor's signing password.
- Prescriptions are converted into deterministic **Canonical JSON** (alphabetically ordered keys), hashed with SHA-256, and signed.
- Pharmacists and patients independently verify the authenticity and dosage integrity of prescriptions.

### 4. Hash-Chained Audit Events & Hardhat Blockchain Anchoring
- Every security and clinical event creates an immutable `AuditEvent` record.
- **Cryptographic Chaining**: Each event calculates `currentHash = SHA-256(canonical(prevHash + action + resource + userId + ip + timestamp))`.
- **Merkle Tree Construction**: Periodically, batches of events are formed into a binary Merkle tree.
- **Solidity Smart Contract**: The Merkle root is permanently recorded onto the Ethereum blockchain via the `AuditAnchor.sol` contract (`anchorRoot`).

---

## Formal Threat Model (STRIDE Categorization)

| Threat Category | Potential Attack Vector | TeleMedSecure Architectural Defense |
| :--- | :--- | :--- |
| **Spoofing (S)** | Attacker impersonates doctor to issue fraudulent controlled prescriptions | Two-factor password-derived Ed25519 private key decryption. Prescriptions without valid cryptographic signatures are rejected by verification endpoints. |
| **Tampering (T)** | Malicious database administrator modifies prescription dosage in PostgreSQL | Tampering breaks the canonical Ed25519 signature. Audit trail row alteration breaks the SHA-256 `prevHash` link and causes smart contract Merkle root verification to fail. |
| **Repudiation (R)** | Attacker denies modifying a patient record or exporting data | Every action generates a chained `AuditEvent` linked to user ID, IP address, user agent, and timestamp, immutably anchored on-chain. |
| **Information Disclosure (I)** | Network eavesdropper intercepts video stream or DB dump | Video encrypted peer-to-peer via AES-GCM Insertable Streams. Database contents are envelope-encrypted; raw ciphertexts are unrecoverable without DEKs. |
| **Denial of Service (D)** | Attacker floods login endpoint or uploads multi-gigabyte payloads | Express rate-limiting (500 req/15min), account lockout after 5 consecutive failures, JSON body limit capped at 10 MB. |
| **Elevation of Privilege (E)** | Patient manipulates client parameters to view admin compliance logs | Server-side Role-Based Access Control (**RBAC**) middleware (`requireRole([Role.ADMIN])`) enforced on all internal endpoints. |

### Crypto-Shredding & GDPR Right to Erasure (Art. 17)
When a patient submits a verified Right to Erasure request, the platform deletes and zeroes the encrypted Data Encryption Keys (**DEKs**) associated with the patient's records. Without the DEKs, the AES-256-GCM ciphertexts become mathematically impossible to decrypt, guaranteeing permanent erasure while preserving immutable audit chain continuity.

---

## Role-Based Workstations & Capabilities

| Role | Access Route | Core Capabilities |
| :--- | :--- | :--- |
| **Patient** | `/patient` | Scheduled consultations, E2EE waiting room, encrypted records, prescription tracker, GDPR consent preferences, Data Portability export, Right-to-Erasure filing. |
| **Doctor** | `/doctor` | Clinical schedule, E2EE video room, encrypted clinical notes editor, Ed25519 e-Prescribing tool, patient vitals monitoring & flags. |
| **Nurse** | `/nurse` | Triage patient roster, vital signs capture form, automated abnormal threshold clinical flags (Hypertension, Tachycardia, Hypoxia, Fever). |
| **Admin** | `/admin` | User & RBAC management, Forensic Compliance Dashboard (HIPAA/GDPR violation charts, live Socket.IO alerts), Prescription Audit module, Forensics Studio. |

---

## Testing & Verification

The repository contains an exhaustive automated test suite covering authentication, RBAC, envelope encryption, Ed25519 signatures, Merkle trees, and on-chain anchoring:

```bash
cd telemedsecure/server
npm test
```

### Test Suite Execution Output
```
PASS tests/investigation.test.ts (13 tests)
PASS tests/rulesEngine.test.ts (9 tests)
PASS tests/auditChain.test.ts (7 tests)
PASS tests/prescription.test.ts (6 tests)
PASS tests/encryption.test.ts (4 tests)
PASS tests/integration.test.ts (8 tests)

Test Suites: 6 passed, 6 total
Tests:       47 passed, 47 total
```

---

## Running the Platform Locally

### 1. Prerequisites
- Node.js v18+ & npm
- Docker (for PostgreSQL container)

### 2. Start PostgreSQL Database
```bash
docker run -d --name telemedsecure-db \
  -e POSTGRES_USER=telemed_user \
  -e POSTGRES_PASSWORD=telemed_pass \
  -e POSTGRES_DB=telemedsecure_db \
  -p 5432:5432 postgres:15
```

### 3. Start Hardhat Blockchain Node
```bash
cd telemedsecure/blockchain
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

### 4. Start Backend Server & Seed Demo Data
```bash
cd telemedsecure/server
npx prisma db push
npm run seed:demo
npm run dev
```

### 5. Start Frontend Client
```bash
cd telemedsecure/client
npm run dev
# Accessible at http://localhost:5173
```

---

## Standard Demo Credentials

| Role | Email | Password | Features |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor1@telemed.com` | `Password123!` | Ed25519 Registered, EPCS Enabled |
| **Patient** | `patient1@telemed.com` | `Password123!` | GDPR Consents Granted |
| **Nurse** | `nurse1@telemed.com` | `Password123!` | Vitals Triage Operator |
| **Admin** | `admin@telemed.com` | `Password123!` | Chief Compliance & Security Officer |
