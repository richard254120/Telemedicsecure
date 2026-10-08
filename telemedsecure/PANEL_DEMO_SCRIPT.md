# TeleMedSecure: 10-Minute Executive & Technical Panel Demo Script

This script provides an exact, minute-by-minute walkthrough to demonstrate the **TeleMedSecure** zero-knowledge medical platform to technical panels, compliance officers, and security evaluators.

---

## Panel Demo Overview Table

| Time | Phase | Target Screen / Tool | Key Technical Feature Demonstrated |
| :--- | :--- | :--- | :--- |
| **00:00 - 01:00** | **Architecture & Zero-Knowledge Intro** | Slide / Architecture Diagram | E2EE WebRTC, AES-256 Envelope DEKs, Ed25519 EPCS, Blockchain Merkle Anchors |
| **01:00 - 02:30** | **Role-Based Authentication & RBAC** | `/login`, `/admin`, `/patient` | Multi-role identity switching, PBKDF2/Argon2 hashing, RBAC route guards |
| **02:30 - 04:00** | **E2EE Consultation & Encrypted Vitals** | `/waiting-room/demo-123`, `/vitals/demo-123` | ECDH P-256 key exchange, WebRTC Insertable Streams, AES-GCM envelope encryption, Clinical Flags |
| **04:00 - 05:30** | **DEA EPCS Digitally Signed Prescription** | `/prescriptions/new`, `/prescriptions/:id` | Doctor Ed25519 keypair derivation, Canonical JSON signing, Public verification |
| **05:30 - 06:45** | **Live Tamper Attempt & Detection** | Terminal (`npm run tamper-audit`) | Database row tampering simulation, cryptographic chain break detection |
| **06:45 - 08:30** | **Incident Investigation & Forensics Studio**| `/investigation`, `/admin` | Audit timeline reconstruction, Evidence hashing, Immutable PDF report creation |
| **08:30 - 10:00** | **On-Chain Smart Contract PDF Verification** | `/investigation/verify` | SHA-256 re-hashing in browser, Hardhat Solidity contract anchor verification (`isRootAnchored`) |

---

## Detailed Step-by-Step Walkthrough

### ⏱️ Minute 0:00 - 01:00: Platform Introduction & Security Architecture
- **Objective**: Establish the core security premise of TeleMedSecure.
- **Talking Points**:
  - *"Traditional telemedicine platforms store medical records and video streams in plain text or with keys held by cloud providers. TeleMedSecure implements a true Zero-Knowledge Architecture."*
  - *"All video streams are encrypted end-to-end between doctor and patient via WebRTC Insertable Streams. Clinical notes and vitals are sealed using AES-256-GCM envelope encryption with per-record Data Encryption Keys (DEKs). Prescriptions are signed with Ed25519 keys, and all audit logs are continuously hash-chained and anchored to an Ethereum smart contract."*

---

### ⏱️ Minute 01:00 - 02:30: Multi-Role Access & RBAC Guard Enforcement
- **Objective**: Demonstrate Role-Based Access Control and authentication.
- **Action**:
  1. Open browser to `http://localhost:5173/login`.
  2. Point out the **1-Click Demo Access** buttons: `Doctor`, `Patient`, `Nurse`, `Admin`.
  3. Click **Doctor** (`doctor1@telemed.com`) → Navigate to `/doctor`. Show doctor's clinical schedule and active consultations.
  4. In the top navigation bar, switch role dropdown to **Patient** → Instantly transitions to `/patient`.
  5. Demonstrate **RBAC Enforcement**: As Patient, attempt to open `http://localhost:5173/admin` or `http://localhost:5173/prescriptions/new`.
  6. The system displays the red **Access Restricted (RBAC Enforcement)** card, preventing privilege escalation.

---

### ⏱️ Minute 02:30 - 04:00: E2EE Consultation & Encrypted Vital Signs
- **Objective**: Demonstrate end-to-end encrypted video and envelope-encrypted clinical capture.
- **Action**:
  1. Switch role to **Doctor** and navigate to `/waiting-room/demo-123`.
  2. Click **Doctor Connected (Enter E2EE Call)** to launch the WebRTC video interface.
  3. Explain: *"The WebRTC media pipeline uses Diffie-Hellman (ECDH P-256) key agreement and AES-GCM Insertable Streams. The central relay server cannot inspect the video frames."*
  4. Switch role to **Nurse** and navigate to `/nurse`.
  5. In **Vitals Entry & Triage**, enter abnormal readings:
     - BP: `148/94` mmHg
     - Heart Rate: `108` bpm
     - SpO2: `90`%
  6. Highlight the real-time **Automated Clinical Flags (Non-Security)**: *Hypertension, Tachycardia, Hypoxia*.
  7. Click **Encrypt & Submit Vitals**. Show that clinical flags alert medical staff without generating false security compliance alerts.

---

### ⏱️ Minute 04:00 - 05:30: Ed25519 Digitally Signed e-Prescription
- **Objective**: Demonstrate DEA EPCS compliance with cryptographic digital signatures.
- **Action**:
  1. Switch role to **Doctor** and navigate to `/prescriptions/new`.
  2. Prescription Items:
     - Medication: `Lisinopril 10mg` (Take 1 daily)
     - Medication: `Atorvastatin 20mg` (Take 1 at bedtime)
  3. Enter doctor's signing password: `Password123!`.
  4. Click **Sign with Ed25519 & Issue Prescription**.
  5. The platform:
     - Decrypts the doctor's Ed25519 private key from envelope storage.
     - Formats canonical JSON with alphabetically sorted keys.
     - Signs the payload using native `crypto.sign`.
  6. Click **Inspect Prescription** → View the Ed25519 public key, canonical SHA-256 digest, and Base64 digital signature.
  7. Click **Verify Signature** → Displays green **VALID & VERIFIED** badge.

---

### ⏱️ Minute 05:30 - 06:45: Live Tamper Attempt & Detection
- **Objective**: Demonstrate detection of unauthorized database modifications.
- **Action**:
  1. Open a terminal in `telemedsecure/server`:
     ```bash
     npm run tamper-audit
     ```
  2. The script directly modifies a database row (altering an audit hash or prescription dosage).
  3. Navigate to **Admin Dashboard** (`http://localhost:5173/admin`).
  4. In **Tab 1: Forensic Compliance Dashboard**:
     - The **Cryptographic Hash-Chain Health** banner switches to **TAMPERING DETECTED / AUDIT CHAIN BREAK**.
     - A CRITICAL **Security Alert** appears in real-time via Socket.IO push.
     - The Compliance Rules Engine flags the violation (`AUDIT_CHAIN_BREAK`, Severity: CRITICAL, Regulation: HIPAA §164.312(c)(2)).

---

### ⏱️ Minute 06:45 - 08:30: Forensic Incident Investigation & PDF Report Generation
- **Objective**: Demonstrate forensic timeline reconstruction and tamper-evident PDF compilation.
- **Action**:
  1. On the Admin Dashboard, click **Forensic Investigation Tool** (`/investigation`).
  2. Select the detected incident or create a new one: *"Audit Hash Chain Discrepancy Investigation"*.
  3. Click **Reconstruct Timeline**:
     - The backend automatically filters canonical `AuditEvent` records by user, resource, and timestamp.
     - Renders a reconstructed chronological sequence of events leading up to the breach.
  4. Under **Evidence Findings**, attach a finding note:
     - Finding Type: `COMPLIANCE_EVIDENCE`
     - Notes: *"Discrepancy identified between database row hash and canonical Merkle root."*
     - The system auto-computes the SHA-256 digest of the finding.
  5. Click **Generate Tamper-Evident Forensic PDF Report**:
     - Compiles full forensic case dossier via `PDFKit`.
     - Automatically anchors the PDF's SHA-256 hash into the **Hardhat Solidity smart contract (`AuditAnchor.sol`)**.
     - Provides an instant download link for the forensic report PDF (`telemedsecure-incident-*.pdf`).

---

### ⏱️ Minute 08:30 - 10:00: On-Chain Smart Contract PDF Report Verification
- **Objective**: Prove non-repudiation and external verification of the forensic report.
- **Action**:
  1. Navigate to `/investigation/verify`.
  2. Drag and drop the downloaded forensic PDF report into the verifier box.
  3. The client computes the file's SHA-256 hash in-flight and queries the Ethereum blockchain:
     ```
     Contract: AuditAnchor.sol (0x5FbDB2315678afecb367f032d93F642f64180aa3)
     Method:   isRootAnchored(bytes32 reportHash)
     ```
  4. Displays vibrant green **AUTHENTIC & ANCHORED ON-CHAIN** badge with Ethereum transaction hash and block number.
  5. Open the downloaded PDF in a text editor, alter a single byte (e.g. change a letter), and upload it again.
  6. The verifier instantly rejects the file with a red **TAMPERED OR UNANCHORED DOCUMENT** badge!
  7. Conclude: *"Even if an adversary compromises the server and PostgreSQL database, they cannot forge the forensic report because its hash is immutably anchored on the Ethereum blockchain."*

---

## Demo Reset Command
To restore the environment to a pristine state before another panel demonstration:
```bash
npm run seed:demo
```
