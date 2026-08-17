// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RuveltJobs} from "../src/RuveltJobs.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployRuveltJobs {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error ChainIdMismatch(uint256 expected, uint256 actual);
    error InvalidPrivateKey();

    function run() external returns (RuveltJobs jobs) {
        uint256 expectedChainId = vm.envUint("BOT_CHAIN_ID");
        if (block.chainid != expectedChainId) {
            revert ChainIdMismatch(expectedChainId, block.chainid);
        }

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        if (deployerPrivateKey == 0 || vm.addr(deployerPrivateKey) == address(0)) {
            revert InvalidPrivateKey();
        }

        vm.startBroadcast(deployerPrivateKey);
        jobs = new RuveltJobs();
        vm.stopBroadcast();
    }
}
