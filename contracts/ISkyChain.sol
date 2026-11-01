// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @title SkyChain aircraft parts record interface
/// @notice Draft API for registration, certificates, status, and custody history.
interface ISkyChain {
    enum PartStatus { Registered, Serviceable, UnderRepair, Retired }

    struct Part {
        string partNumber;
        string serialNumber;
        address manufacturer;
        address custodian;
        bytes32 certificateHash;
        string certificateCID;
        PartStatus status;
        uint256 registeredAt;
    }

    event PartRegistered(bytes32 indexed partId, address indexed manufacturer, string partNumber, string serialNumber);
    event CertificateRecorded(bytes32 indexed partId, address indexed issuer, bytes32 certificateHash, string certificateCID);
    event StatusUpdated(bytes32 indexed partId, address indexed repairStation, PartStatus previousStatus, PartStatus newStatus);
    event TransferStarted(bytes32 indexed partId, address indexed from, address indexed to);
    event TransferAccepted(bytes32 indexed partId, address indexed from, address indexed to);
    event TransferCancelled(bytes32 indexed partId, address indexed recipient);

    /// @notice Derive the record key from the exact, case-sensitive identifiers.
    function getPartId(string calldata partNumber, string calldata serialNumber) external pure returns (bytes32);

    /// @notice A manufacturer registers a unique part and becomes its first custodian.
    function registerPart(string calldata partNumber, string calldata serialNumber) external returns (bytes32 partId);

    /// @notice An issuer records the SHA-256 hash of the raw certificate file and its IPFS CID.
    function recordCertificate(bytes32 partId, bytes32 certificateHash, string calldata certificateCID) external;

    /// @notice A repair station that holds the part changes its status. Retirement is final.
    function updateStatus(bytes32 partId, PartStatus newStatus) external;

    /// @notice The current custodian names one recipient. Custody does not change yet.
    function initiateTransfer(bytes32 partId, address recipient) external;

    /// @notice Only the named recipient can accept and become the custodian.
    function acceptTransfer(bytes32 partId) external;

    /// @notice The current custodian can cancel a pending transfer.
    function cancelTransfer(bytes32 partId) external;

    /// @notice Read the latest record. Events contain the prior changes.
    function getPart(bytes32 partId) external view returns (Part memory);

    /// @notice Return the pending recipient, or the zero address if there is none.
    function pendingRecipient(bytes32 partId) external view returns (address);

    /// @notice Compare a locally computed SHA-256 digest with the current certificate hash.
    function verifyCertificate(bytes32 partId, bytes32 candidateHash) external view returns (bool);
}
