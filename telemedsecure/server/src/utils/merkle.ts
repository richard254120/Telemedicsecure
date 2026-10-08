import crypto from 'crypto';

/**
 * Hash two 32-byte buffers or hex strings using SHA-256
 */
export function hashPair(left: string | Buffer, right: string | Buffer): string {
  const leftBuf = Buffer.isBuffer(left) ? left : Buffer.from(left.replace(/^0x/, ''), 'hex');
  const rightBuf = Buffer.isBuffer(right) ? right : Buffer.from(right.replace(/^0x/, ''), 'hex');
  return crypto.createHash('sha256').update(Buffer.concat([leftBuf, rightBuf])).digest('hex');
}

export interface MerkleProofStep {
  sibling: string;
  position: 'left' | 'right';
}

/**
 * Standard cryptographic Merkle Tree implementation
 */
export class MerkleTree {
  public leaves: string[];
  public layers: string[][];

  constructor(leaves: string[]) {
    if (leaves.length === 0) {
      // Empty tree default leaf
      this.leaves = [crypto.createHash('sha256').update('EMPTY_MERKLE_TREE').digest('hex')];
    } else {
      this.leaves = leaves.map(l => l.replace(/^0x/, ''));
    }
    this.layers = [this.leaves];
    this.buildTree();
  }

  private buildTree() {
    let currentLayer = this.layers[0];
    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          // If odd number of nodes, duplicate the last element
          nextLayer.push(hashPair(currentLayer[i], currentLayer[i]));
        }
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    const topLayer = this.layers[this.layers.length - 1];
    return topLayer[0] || '0'.repeat(64);
  }

  public getRootBytes32(): string {
    return '0x' + this.getRoot();
  }

  public getProof(leafIndex: number): MerkleProofStep[] {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds`);
    }

    const proof: MerkleProofStep[] = [];
    let currentIndex = leafIndex;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const currentLayer = this.layers[i];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLayer.length) {
        proof.push({
          sibling: currentLayer[siblingIndex],
          position: isRightNode ? 'left' : 'right'
        });
      } else {
        // Paired with self
        proof.push({
          sibling: currentLayer[currentIndex],
          position: 'right'
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  public static verifyProof(leaf: string, proof: MerkleProofStep[], root: string): boolean {
    let currentHash = leaf.replace(/^0x/, '');
    const cleanRoot = root.replace(/^0x/, '');

    for (const step of proof) {
      const sibling = step.sibling.replace(/^0x/, '');
      if (step.position === 'left') {
        currentHash = hashPair(sibling, currentHash);
      } else {
        currentHash = hashPair(currentHash, sibling);
      }
    }

    return currentHash.toLowerCase() === cleanRoot.toLowerCase();
  }
}
