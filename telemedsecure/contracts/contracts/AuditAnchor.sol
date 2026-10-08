// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditAnchor
 * @dev Anchors Merkle roots of hash-chained audit events onto the blockchain for immutable non-repudiation.
 */
contract AuditAnchor {
    event RootAnchored(bytes32 indexed root, uint256 indexed index, uint256 timestamp);

    bytes32[] public roots;
    mapping(bytes32 => bool) public isRootAnchored;
    mapping(bytes32 => uint256) public rootTimestamp;

    /**
     * @notice Anchor a Merkle root on-chain
     * @param root The bytes32 Merkle root of the batch of audit events
     * @return index The index of the newly added root
     */
    function anchorRoot(bytes32 root) external returns (uint256 index) {
        require(root != bytes32(0), "Invalid zero root");
        roots.push(root);
        index = roots.length - 1;
        isRootAnchored[root] = true;
        rootTimestamp[root] = block.timestamp;
        emit RootAnchored(root, index, block.timestamp);
    }

    /**
     * @notice Retrieve an anchored Merkle root by its index
     * @param index The zero-based index in the roots array
     * @return The 32-byte Merkle root
     */
    function getRoot(uint256 index) external view returns (bytes32) {
        require(index < roots.length, "Index out of bounds");
        return roots[index];
    }

    /**
     * @notice Get total count of anchored roots
     */
    function getRootCount() external view returns (uint256) {
        return roots.length;
    }

    /**
     * @notice Get the most recently anchored root
     */
    function getLastRoot() external view returns (bytes32 root, uint256 index) {
        require(roots.length > 0, "No roots anchored");
        index = roots.length - 1;
        root = roots[index];
    }
}
