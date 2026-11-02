// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

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

    function getPartId(string calldata partNumber, string calldata serialNumber) external pure returns (bytes32);

    function registerPart(string calldata partNumber, string calldata serialNumber) external returns (bytes32 partId);

    function recordCertificate(bytes32 partId, bytes32 certificateHash, string calldata certificateCID) external;

    function updateStatus(bytes32 partId, PartStatus newStatus) external;

    function initiateTransfer(bytes32 partId, address recipient) external;

    function acceptTransfer(bytes32 partId) external;

    function cancelTransfer(bytes32 partId) external;

    function getPart(bytes32 partId) external view returns (Part memory);

    function pendingRecipient(bytes32 partId) external view returns (address);

    function verifyCertificate(bytes32 partId, bytes32 candidateHash) external view returns (bool);
}
