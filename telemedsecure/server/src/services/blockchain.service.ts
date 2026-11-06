import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Standard Hardhat Account #0 private key
const HARDHAT_DEFAULT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545';

let contractInstance: ethers.Contract | null = null;
let providerInstance: ethers.JsonRpcProvider | null = null;
let walletInstance: ethers.Wallet | null = null;

/**
 * Locate the deployment artifact across every way the server may be launched.
 *
 * `tsc` compiles `src/**.ts` to `dist/**.js` but does NOT copy the sibling
 * `contracts/deployed.json`, so a build run with `node dist/index.js` would
 * otherwise never find the contract address and would silently degrade to
 * unanchored placeholders — on-chain proof would only work when the app was
 * started from source (tsx/jest). We probe the known candidate locations so the
 * anchoring path is identical whether launched from `src` or `dist`, dev or prod.
 */
function resolveDeploymentPath(): string | null {
  const candidates = [
    path.join(__dirname, '../contracts/deployed.json'),            // src/services -> src/contracts, or dist/services -> dist/contracts
    path.join(__dirname, '../../src/contracts/deployed.json'),     // dist/services -> src/contracts
    path.join(__dirname, '../../../src/contracts/deployed.json'),  // deeper build layouts
    path.join(process.cwd(), 'src/contracts/deployed.json'),
    path.join(process.cwd(), 'dist/contracts/deployed.json'),
    path.join(process.cwd(), 'contracts/deployed.json')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

export async function getBlockchainContract(): Promise<ethers.Contract | null> {
  if (contractInstance) return contractInstance;

  try {
    const deploymentPath = resolveDeploymentPath();
    if (!deploymentPath) {
      console.warn('Blockchain: deployed.json not found in any known location; on-chain anchoring disabled');
      return null;
    }

    const deployed = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    providerInstance = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
    walletInstance = new ethers.Wallet(HARDHAT_DEFAULT_PRIVATE_KEY, providerInstance);

    contractInstance = new ethers.Contract(deployed.address, deployed.abi, walletInstance);
    return contractInstance;
  } catch (err: any) {
    console.warn('Blockchain: could not connect to Hardhat node:', err.message);
    return null;
  }
}

let txQueue = Promise.resolve() as Promise<any>;

/**
 * Deterministic sender-nonce tracking.
 *
 * ethers' automatic nonce inference races under Hardhat's instant automining:
 * two anchoring transactions queued back-to-back can both read the same pending
 * count before either is mined, so the node rejects the second with
 * `NONCE_EXPIRED / Nonce too low`. Because every write here is funnelled through
 * the serialised `txQueue` above (one `doAnchor` runs at a time, and the previous
 * receipt is already mined when the next begins), we can safely assign the nonce
 * ourselves: seed it from the chain once, then advance strictly from each mined
 * receipt. Any send failure re-seeds from `latest` to self-heal.
 */
let managedNonce: number | null = null;

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
  rootIndex: number;
  contractAddress: string;
  /**
   * `true` only when the root was written to a live Solidity contract and a real
   * transaction receipt was returned. `false` means the Hardhat node was
   * unreachable and the values below are a LOCAL PLACEHOLDER, not on-chain
   * proof. Callers MUST surface this so a report is never presented as
   * "anchored to the blockchain" when it is not — that would be a false
   * integrity guarantee.
   */
  anchored: boolean;
}

async function doAnchor(rootHex: string): Promise<AnchorResult> {
  const contract = await getBlockchainContract();
  const bytes32Root = rootHex.startsWith('0x') ? rootHex : '0x' + rootHex;

  // Honest PENDING placeholder: no on-chain proof exists yet. Callers MUST key
  // off `anchored` and store null tx/block so nothing is misrepresented as sealed.
  const pending = (): AnchorResult => ({
    txHash: '0x' + require('crypto').createHash('sha256').update(bytes32Root + Date.now()).digest('hex'),
    blockNumber: 0,
    rootIndex: -1,
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    anchored: false
  });

  if (!contract) {
    console.warn('Blockchain: contract handle unavailable, recording PENDING (not anchored)');
    return pending();
  }

  // A live contract handle does not prove the node is answering. Ping first; on
  // outage we record a PENDING anchor rather than throwing, so an audit-batch or
  // report submission degrades gracefully and is never mistaken for a breach.
  if (!(await isBlockchainReachable())) {
    console.warn('Blockchain: node unreachable at anchor time, recording PENDING (not anchored)');
    return pending();
  }

  try {
    const nonce = managedNonce ?? (await providerInstance!.getTransactionCount(walletInstance!.address, 'latest'));
    const tx = await contract.anchorRoot(bytes32Root, { nonce });
    const receipt: ethers.TransactionReceipt = await tx.wait();
    // Mining succeeded: the next serialized send uses the immediately following nonce.
    managedNonce = nonce + 1;

    let rootIndex = 0;
    try {
      const count = await contract.getRootCount();
      rootIndex = Number(count) - 1;
    } catch {}

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      rootIndex,
      contractAddress: await contract.getAddress(),
      anchored: true
    };
  } catch (err: any) {
    // Re-seed from the chain so a failed/replaced transaction cannot wedge the nonce.
    managedNonce = null;
    console.warn('Blockchain: anchor submission failed, recording PENDING (not anchored):', err?.shortMessage || err?.message);
    return pending();
  }
}

/**
 * Anchor a 32-byte Merkle root on the Hardhat blockchain (sequentially queued to avoid nonce collision)
 */
export async function anchorRootOnChain(rootHex: string): Promise<AnchorResult> {
  return new Promise((resolve, reject) => {
    txQueue = txQueue.then(async () => {
      try {
        const res = await doAnchor(rootHex);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Whether the anchoring blockchain node is ACTUALLY answering requests.
 *
 * Constructing an ethers contract handle does no network I/O, so a non-null
 * contract only proves `deployed.json` was readable — it cannot distinguish a
 * running node from a stopped one. We therefore issue a real RPC call; only a
 * successful reply counts as reachable. Lets verifiers separate a genuine
 * on-chain mismatch (root absent from a live chain) from a mere outage.
 */
export async function isBlockchainReachable(): Promise<boolean> {
  const contract = await getBlockchainContract();
  if (!contract || !providerInstance) return false;
  try {
    await Promise.race([
      providerInstance.send('eth_blockNumber', []),
      new Promise((_, rej) => setTimeout(() => rej(new Error('rpc timeout')), 3000))
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve anchored Merkle root from blockchain by index
 */
export async function getRootFromChain(index: number): Promise<string | null> {
  const contract = await getBlockchainContract();
  if (!contract) return null;

  try {
    const rootBytes32: string = await contract.getRoot(index);
    return rootBytes32;
  } catch (err: any) {
    console.error('Blockchain: getRoot error:', err.message);
    return null;
  }
}

/**
 * Check if a Merkle root exists on-chain
 */
export async function isRootAnchoredOnChain(rootHex: string): Promise<boolean> {
  const contract = await getBlockchainContract();
  if (!contract) return false;

  try {
    const bytes32Root = rootHex.startsWith('0x') ? rootHex : '0x' + rootHex;
    const isAnchored: boolean = await contract.isRootAnchored(bytes32Root);
    return isAnchored;
  } catch {
    return false;
  }
}
