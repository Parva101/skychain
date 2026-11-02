// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ISkyChain} from "./ISkyChain.sol";

contract SkyChain is AccessControl, ISkyChain {
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant REPAIR_STATION_ROLE = keccak256("REPAIR_STATION_ROLE");

    mapping(bytes32 => Part) private parts;
    mapping(bytes32 => address) public override pendingRecipient;

    constructor(address admin) {
        require(admin != address(0), "Zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function getPartId(string calldata partNumber, string calldata serialNumber) public pure override returns (bytes32) {
        return keccak256(abi.encode(partNumber, serialNumber));
    }

    function registerPart(string calldata partNumber, string calldata serialNumber)
        external override onlyRole(MANUFACTURER_ROLE) returns (bytes32 partId)
    {
        require(bytes(partNumber).length > 0 && bytes(serialNumber).length > 0, "Empty identifier");
        partId = getPartId(partNumber, serialNumber);
        require(parts[partId].manufacturer == address(0), "Part already registered");
        parts[partId] = Part({
            partNumber: partNumber,
            serialNumber: serialNumber,
            manufacturer: msg.sender,
            custodian: msg.sender,
            certificateHash: bytes32(0),
            certificateCID: "",
            status: PartStatus.Registered,
            registeredAt: block.timestamp
        });
        emit PartRegistered(partId, msg.sender, partNumber, serialNumber);
    }

    function recordCertificate(bytes32 partId, bytes32 certificateHash, string calldata certificateCID)
        external override onlyRole(ISSUER_ROLE)
    {
        Part storage part = _existingPart(partId);
        require(part.status != PartStatus.Retired, "Part retired");
        require(certificateHash != bytes32(0), "Empty certificate hash");
        require(bytes(certificateCID).length > 0, "Empty certificate CID");
        _clearTransfer(partId);
        part.certificateHash = certificateHash;
        part.certificateCID = certificateCID;
        emit CertificateRecorded(partId, msg.sender, certificateHash, certificateCID);
    }

    function updateStatus(bytes32 partId, PartStatus newStatus) external override onlyRole(REPAIR_STATION_ROLE) {
        Part storage part = _existingPart(partId);
        require(msg.sender == part.custodian, "Not current custodian");
        require(part.status != PartStatus.Retired, "Part retired");
        require(newStatus != PartStatus.Registered && newStatus != part.status, "Invalid status change");
        PartStatus previousStatus = part.status;
        _clearTransfer(partId);
        part.status = newStatus;
        emit StatusUpdated(partId, msg.sender, previousStatus, newStatus);
    }

    function initiateTransfer(bytes32 partId, address recipient) external override {
        Part storage part = _existingPart(partId);
        require(msg.sender == part.custodian, "Not current custodian");
        require(part.status != PartStatus.Retired, "Part retired");
        require(recipient != address(0) && recipient != msg.sender, "Invalid recipient");
        require(pendingRecipient[partId] == address(0), "Transfer already pending");
        pendingRecipient[partId] = recipient;
        emit TransferStarted(partId, msg.sender, recipient);
    }

    function acceptTransfer(bytes32 partId) external override {
        Part storage part = _existingPart(partId);
        require(msg.sender == pendingRecipient[partId], "Not pending recipient");
        require(part.status != PartStatus.Retired, "Part retired");
        address previousCustodian = part.custodian;
        delete pendingRecipient[partId];
        part.custodian = msg.sender;
        emit TransferAccepted(partId, previousCustodian, msg.sender);
    }

    function cancelTransfer(bytes32 partId) external override {
        Part storage part = _existingPart(partId);
        require(msg.sender == part.custodian, "Not current custodian");
        require(pendingRecipient[partId] != address(0), "No pending transfer");
        _clearTransfer(partId);
    }

    function getPart(bytes32 partId) external view override returns (Part memory) {
        return _existingPart(partId);
    }

    function verifyCertificate(bytes32 partId, bytes32 candidateHash) external view override returns (bool) {
        Part storage part = _existingPart(partId);
        return candidateHash != bytes32(0) && part.certificateHash == candidateHash;
    }

    function _existingPart(bytes32 partId) private view returns (Part storage part) {
        part = parts[partId];
        require(part.manufacturer != address(0), "Unknown part");
    }

    function _clearTransfer(bytes32 partId) private {
        address recipient = pendingRecipient[partId];
        if (recipient != address(0)) {
            delete pendingRecipient[partId];
            emit TransferCancelled(partId, recipient);
        }
    }
}
