// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RuveltJobs} from "../src/RuveltJobs.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function warp(uint256 newTimestamp) external;
}

contract RevertingRecipient {
    receive() external payable {
        revert();
    }
}

contract ReentrantRecipient {
    RuveltJobs private immutable jobs;
    bool public reentryBlocked;

    constructor(RuveltJobs jobs_) {
        jobs = jobs_;
    }

    function withdrawClaim() external {
        jobs.withdraw(payable(address(this)));
    }

    receive() external payable {
        try jobs.withdraw(payable(address(this))) {}
        catch {
            reentryBlocked = true;
        }
    }
}

contract RuveltJobsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    RuveltJobs private jobs;

    address private constant CREATOR = address(0xC0FFEE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA401);
    address private constant OUTSIDER = address(0xBAD);

    uint256 private constant BUDGET = 10 ether;
    uint64 private constant REVIEW_PERIOD = 1 days;

    function setUp() public {
        jobs = new RuveltJobs();
        vm.deal(CREATOR, 100 ether);
    }

    function testCreateFundedJobTracksEscrow() public {
        uint256 jobId = _createJob(true);
        RuveltJobs.Job memory job = jobs.getJob(jobId);

        _assertEq(uint256(job.state), uint256(RuveltJobs.JobState.Open));
        _assertEq(job.creator, CREATOR);
        _assertEq(job.budget, BUDGET);
        _assertEq(jobs.totalEscrowLiability(), BUDGET);
        _assertEq(address(jobs).balance, BUDGET);
    }

    function testCreateRejectsInvalidInputsAndFunding() public {
        uint64 applicationDeadline = uint64(block.timestamp + 1 days);
        uint64 deliveryDeadline = uint64(block.timestamp + 2 days);

        vm.startPrank(CREATOR);
        vm.expectRevert(RuveltJobs.InvalidReference.selector);
        jobs.createJob("", BUDGET, applicationDeadline, deliveryDeadline, REVIEW_PERIOD);

        vm.expectRevert(RuveltJobs.InvalidBudget.selector);
        jobs.createJob("ipfs://job", 0, applicationDeadline, deliveryDeadline, REVIEW_PERIOD);

        vm.expectRevert(RuveltJobs.InvalidDeadlines.selector);
        jobs.createJob(
            "ipfs://job", BUDGET, applicationDeadline, applicationDeadline, REVIEW_PERIOD
        );

        vm.expectRevert(RuveltJobs.InvalidReviewPeriod.selector);
        jobs.createJob("ipfs://job", BUDGET, applicationDeadline, deliveryDeadline, 1 hours - 1);

        vm.expectRevert(RuveltJobs.InvalidReviewPeriod.selector);
        jobs.createJob("ipfs://job", BUDGET, applicationDeadline, deliveryDeadline, 30 days + 1);

        vm.expectRevert(RuveltJobs.IncorrectFunding.selector);
        jobs.createJob{value: 1 ether}(
            "ipfs://job", BUDGET, applicationDeadline, deliveryDeadline, REVIEW_PERIOD
        );
        vm.stopPrank();
    }

    function testOnlyCreatorCanFundAndExactFundingIsRequired() public {
        uint256 jobId = _createJob(false);

        vm.deal(OUTSIDER, BUDGET);
        vm.prank(OUTSIDER);
        vm.expectRevert(RuveltJobs.Unauthorized.selector);
        jobs.fundJob{value: BUDGET}(jobId);

        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.IncorrectFunding.selector);
        jobs.fundJob{value: BUDGET - 1}(jobId);

        vm.prank(CREATOR);
        jobs.fundJob{value: BUDGET}(jobId);

        _assertEq(uint256(jobs.getJob(jobId).state), uint256(RuveltJobs.JobState.Open));
        _assertEq(jobs.totalEscrowLiability(), BUDGET);
    }

    function testFundingAtApplicationDeadlineIsRejected() public {
        uint256 jobId = _createJob(false);
        vm.warp(jobs.getJob(jobId).applicationDeadline);

        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.DeadlinePassed.selector);
        jobs.fundJob{value: BUDGET}(jobId);
    }

    function testApplicationsCanBeSubmittedAndUpdatedBeforeDeadline() public {
        uint256 jobId = _createJob(true);

        vm.prank(ALICE);
        jobs.submitApplication(jobId, "ipfs://proposal-1");
        (bool exists, string memory proposalRef) = jobs.getApplication(jobId, ALICE);
        _assertTrue(exists);
        _assertEq(proposalRef, "ipfs://proposal-1");

        vm.prank(ALICE);
        jobs.updateApplication(jobId, "ipfs://proposal-2");
        (, proposalRef) = jobs.getApplication(jobId, ALICE);
        _assertEq(proposalRef, "ipfs://proposal-2");

        vm.prank(ALICE);
        vm.expectRevert(RuveltJobs.ApplicationAlreadyExists.selector);
        jobs.submitApplication(jobId, "ipfs://duplicate");

        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.CreatorCannotApply.selector);
        jobs.submitApplication(jobId, "ipfs://creator");

        vm.prank(BOB);
        vm.expectRevert(RuveltJobs.ApplicationMissing.selector);
        jobs.updateApplication(jobId, "ipfs://missing");
    }

    function testApplicationsCloseExactlyAtDeadline() public {
        uint256 jobId = _createJob(true);
        vm.warp(jobs.getJob(jobId).applicationDeadline);

        vm.prank(ALICE);
        vm.expectRevert(RuveltJobs.DeadlinePassed.selector);
        jobs.submitApplication(jobId, "ipfs://late");
    }

    function testCreatorCanSelectAfterApplicationsClose() public {
        uint256 jobId = _createJob(true);
        _apply(jobId, ALICE);
        vm.warp(jobs.getJob(jobId).applicationDeadline);

        _selectOne(jobId, ALICE);

        _assertEq(uint256(jobs.getJob(jobId).state), uint256(RuveltJobs.JobState.Selected));
        _assertEq(jobs.allocationOf(jobId, ALICE), BUDGET);
    }

    function testSelectionRejectsUnauthorizedInvalidAndDuplicateEntries() public {
        uint256 jobId = _createJob(true);
        _apply(jobId, ALICE);

        address[] memory contributors = new address[](1);
        contributors[0] = ALICE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = BUDGET;

        vm.prank(OUTSIDER);
        vm.expectRevert(RuveltJobs.Unauthorized.selector);
        jobs.selectContributors(jobId, contributors, amounts);

        contributors[0] = BOB;
        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.ApplicationMissing.selector);
        jobs.selectContributors(jobId, contributors, amounts);

        contributors = new address[](2);
        contributors[0] = ALICE;
        contributors[1] = ALICE;
        amounts = new uint256[](2);
        amounts[0] = BUDGET / 2;
        amounts[1] = BUDGET / 2;
        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.DuplicateContributor.selector);
        jobs.selectContributors(jobId, contributors, amounts);

        contributors = new address[](1);
        contributors[0] = ALICE;
        amounts = new uint256[](1);
        amounts[0] = BUDGET - 1;
        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.InvalidSelection.selector);
        jobs.selectContributors(jobId, contributors, amounts);
    }

    function testSelectionEnforcesContributorLimit() public {
        uint256 jobId = _createJob(true);
        uint256 length = jobs.MAX_CONTRIBUTORS() + 1;
        address[] memory contributors = new address[](length);
        uint256[] memory amounts = new uint256[](length);

        for (uint256 i; i < length; ++i) {
            address contributor = address(uint160(0x1000 + i));
            contributors[i] = contributor;
            amounts[i] = 1;
            _apply(jobId, contributor);
        }

        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.InvalidSelection.selector);
        jobs.selectContributors(jobId, contributors, amounts);
    }

    function testDeliveryTransitionsOnlyAfterEveryContributorDelivers() public {
        uint256 jobId = _selectedTwoContributorJob();

        vm.prank(ALICE);
        jobs.deliverWork(jobId, "ipfs://alice-work");
        RuveltJobs.Job memory job = jobs.getJob(jobId);
        _assertEq(uint256(job.state), uint256(RuveltJobs.JobState.Selected));
        _assertEq(job.deliveredCount, 1);

        vm.prank(ALICE);
        vm.expectRevert(RuveltJobs.AlreadyDelivered.selector);
        jobs.deliverWork(jobId, "ipfs://alice-again");

        uint256 deliveredAt = block.timestamp;
        vm.prank(BOB);
        jobs.deliverWork(jobId, "ipfs://bob-work");
        job = jobs.getJob(jobId);
        _assertEq(uint256(job.state), uint256(RuveltJobs.JobState.Delivered));
        _assertEq(job.deliveredCount, 2);
        _assertEq(job.reviewDeadline, deliveredAt + REVIEW_PERIOD);
    }

    function testDeliveryRejectsUnselectedAndDeadlineBoundary() public {
        uint256 jobId = _selectedOneContributorJob(ALICE);

        vm.prank(OUTSIDER);
        vm.expectRevert(RuveltJobs.NotSelected.selector);
        jobs.deliverWork(jobId, "ipfs://outsider");

        vm.warp(jobs.getJob(jobId).deliveryDeadline);
        vm.prank(ALICE);
        vm.expectRevert(RuveltJobs.DeadlinePassed.selector);
        jobs.deliverWork(jobId, "ipfs://late");
    }

    function testCreatorAcceptanceSettlesWithoutInlineTransfers() public {
        uint256 jobId = _deliveredTwoContributorJob();

        vm.prank(CREATOR);
        jobs.acceptJob(jobId);

        _assertEq(uint256(jobs.getJob(jobId).state), uint256(RuveltJobs.JobState.Settled));
        _assertEq(jobs.claimable(ALICE), 4 ether);
        _assertEq(jobs.claimable(BOB), 6 ether);
        _assertEq(jobs.completedJobCount(ALICE), 1);
        _assertEq(jobs.completedJobCount(BOB), 1);
        _assertEq(jobs.totalEscrowLiability(), 0);
        _assertEq(jobs.totalClaimableLiability(), BUDGET);
        _assertEq(address(jobs).balance, BUDGET);
    }

    function testPermissionlessFinalizationStartsAtReviewDeadline() public {
        uint256 jobId = _deliveredOneContributorJob(ALICE);
        uint64 reviewDeadline = jobs.getJob(jobId).reviewDeadline;

        vm.warp(reviewDeadline - 1);
        vm.prank(OUTSIDER);
        vm.expectRevert(RuveltJobs.DeadlineNotReached.selector);
        jobs.finalizeJob(jobId);

        vm.warp(reviewDeadline);
        vm.prank(OUTSIDER);
        jobs.finalizeJob(jobId);

        _assertEq(jobs.claimable(ALICE), BUDGET);
        _assertEq(jobs.completedJobCount(ALICE), 1);
    }

    function testOpenCancellationRefundsCreatorAsClaimable() public {
        uint256 jobId = _createJob(true);

        vm.prank(CREATOR);
        jobs.cancelJob(jobId);

        _assertEq(uint256(jobs.getJob(jobId).state), uint256(RuveltJobs.JobState.Cancelled));
        _assertEq(jobs.claimable(CREATOR), BUDGET);
        _assertEq(jobs.totalEscrowLiability(), 0);
        _assertEq(jobs.totalClaimableLiability(), BUDGET);
    }

    function testIncompleteSelectedJobCanOnlyCancelAfterDeadline() public {
        uint256 jobId = _selectedTwoContributorJob();
        vm.prank(ALICE);
        jobs.deliverWork(jobId, "ipfs://partial");

        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.DeadlineNotReached.selector);
        jobs.cancelJob(jobId);

        vm.warp(jobs.getJob(jobId).deliveryDeadline);
        vm.prank(CREATOR);
        jobs.cancelJob(jobId);

        _assertEq(jobs.claimable(CREATOR), BUDGET);
        _assertEq(jobs.claimable(ALICE), 0);
        _assertEq(jobs.completedJobCount(ALICE), 0);
    }

    function testDeliveredJobCannotBeCancelled() public {
        uint256 jobId = _deliveredOneContributorJob(ALICE);

        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.InvalidState.selector);
        jobs.cancelJob(jobId);
    }

    function testWithdrawalPaysChosenRecipientAndClearsLiability() public {
        uint256 jobId = _deliveredOneContributorJob(ALICE);
        vm.prank(CREATOR);
        jobs.acceptJob(jobId);

        uint256 beforeBalance = BOB.balance;
        vm.prank(ALICE);
        jobs.withdraw(payable(BOB));

        _assertEq(BOB.balance, beforeBalance + BUDGET);
        _assertEq(jobs.claimable(ALICE), 0);
        _assertEq(jobs.totalClaimableLiability(), 0);
        _assertEq(address(jobs).balance, 0);
    }

    function testWithdrawalFailurePreservesClaim() public {
        uint256 jobId = _deliveredOneContributorJob(ALICE);
        vm.prank(CREATOR);
        jobs.acceptJob(jobId);
        RevertingRecipient recipient = new RevertingRecipient();

        vm.prank(ALICE);
        vm.expectRevert(RuveltJobs.TransferFailed.selector);
        jobs.withdraw(payable(address(recipient)));

        _assertEq(jobs.claimable(ALICE), BUDGET);
        _assertEq(jobs.totalClaimableLiability(), BUDGET);
    }

    function testWithdrawalBlocksReentrancyWithoutBlockingPayment() public {
        ReentrantRecipient recipient = new ReentrantRecipient(jobs);
        uint256 jobId = _deliveredOneContributorJob(address(recipient));
        vm.prank(CREATOR);
        jobs.acceptJob(jobId);

        recipient.withdrawClaim();

        _assertTrue(recipient.reentryBlocked());
        _assertEq(address(recipient).balance, BUDGET);
        _assertEq(jobs.claimable(address(recipient)), 0);
    }

    function testDirectNativePaymentIsRejected() public {
        vm.prank(CREATOR);
        vm.expectRevert(RuveltJobs.DirectPaymentDisabled.selector);
        (bool success,) = address(jobs).call{value: 1 ether}("");
        success;
    }

    function _createJob(bool funded) private returns (uint256 jobId) {
        uint64 applicationDeadline = uint64(block.timestamp + 1 days);
        uint64 deliveryDeadline = uint64(block.timestamp + 3 days);
        vm.prank(CREATOR);
        jobId = jobs.createJob{value: funded ? BUDGET : 0}(
            "ipfs://job", BUDGET, applicationDeadline, deliveryDeadline, REVIEW_PERIOD
        );
    }

    function _apply(uint256 jobId, address applicant) private {
        vm.prank(applicant);
        jobs.submitApplication(jobId, "ipfs://proposal");
    }

    function _selectOne(uint256 jobId, address contributor) private {
        address[] memory contributors = new address[](1);
        contributors[0] = contributor;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = BUDGET;
        vm.prank(CREATOR);
        jobs.selectContributors(jobId, contributors, amounts);
    }

    function _selectedOneContributorJob(address contributor) private returns (uint256 jobId) {
        jobId = _createJob(true);
        _apply(jobId, contributor);
        _selectOne(jobId, contributor);
    }

    function _selectedTwoContributorJob() private returns (uint256 jobId) {
        jobId = _createJob(true);
        _apply(jobId, ALICE);
        _apply(jobId, BOB);

        address[] memory contributors = new address[](2);
        contributors[0] = ALICE;
        contributors[1] = BOB;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 4 ether;
        amounts[1] = 6 ether;
        vm.prank(CREATOR);
        jobs.selectContributors(jobId, contributors, amounts);
    }

    function _deliveredOneContributorJob(address contributor) private returns (uint256 jobId) {
        jobId = _selectedOneContributorJob(contributor);
        vm.prank(contributor);
        jobs.deliverWork(jobId, "ipfs://work");
    }

    function _deliveredTwoContributorJob() private returns (uint256 jobId) {
        jobId = _selectedTwoContributorJob();
        vm.prank(ALICE);
        jobs.deliverWork(jobId, "ipfs://alice-work");
        vm.prank(BOB);
        jobs.deliverWork(jobId, "ipfs://bob-work");
    }

    function _assertTrue(bool value) private pure {
        require(value, "assert true failed");
    }

    function _assertEq(uint256 actual, uint256 expected) private pure {
        require(actual == expected, "assert uint failed");
    }

    function _assertEq(address actual, address expected) private pure {
        require(actual == expected, "assert address failed");
    }

    function _assertEq(string memory actual, string memory expected) private pure {
        require(keccak256(bytes(actual)) == keccak256(bytes(expected)), "assert string failed");
    }
}
