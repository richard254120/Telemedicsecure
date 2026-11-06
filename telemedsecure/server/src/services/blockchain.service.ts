import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Standard Hardhat Account #0 private key
const HARDHAT_DEFAULT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545';

let contractInstance: ethers.Contract | null = null;
let providerInstance: ethers.JsonRpcProvider | null = null;
let walletInstance: ethers.Wallet | null = null;

export async function getBlockchainContract(): Promise<ethers.Contract | null> {
  if (contractInstance) return contractInstance;

  try {
    const deploymentPath = path.join(__dirname, '../contracts/deployed.json');
    if (!fs.existsSync(deploymentPath)) {
      console.warn('Blockchain: deployed.json not found at', deploymentPath);
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

  if (!contract) {
    console.warn('Blockchain: Hardhat node unreachable, returning SIMULATED (unanchored) placeholder');
    const mockHash = '0x' + require('crypto').createHash('sha256').update(bytes32Root + Date.now()).digest('hex');
    return {
      txHash: mockHash,
      blockNumber: 0,
      rootIndex: -1,
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      anchored: false
    };
  }

  const tx = await contract.anchorRoot(bytes32Root);
  const receipt = await tx.wait();

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
 * Whether the anchoring smart contract is currently reachable.
 * Lets verifiers distinguish "node offline" from "root genuinely absent".
 */
export async function isBlockchainReachable(): Promise<boolean> {
  return (await getBlockchainContract()) !== null;
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
