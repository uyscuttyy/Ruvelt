// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract RuveltJobs {
    uint256 public constant MAX_CONTRIBUTORS = 20;
    uint64 public constant MIN_REVIEW_PERIOD = 1 hours;
    uint64 public constant MAX_REVIEW_PERIOD = 30 days;

    enum JobState {
        Unfunded,
        Open,
        Selected,
        Delivered,
        Settled,
        Cancelled
    }

    struct Job {
        address creator;
        uint256 budget;
        uint64 applicationDeadline;
        uint64 deliveryDeadline;
        uint64 reviewPeriod;
        uint64 reviewDeadline;
        uint32 deliveredCount;
        JobState state;
        string detailsRef;
    }

    struct Application {
        bool exists;
        string proposalRef;
    }

    error UnknownJob();
    error Unauthorized();
    error InvalidState();
    error InvalidReference();
    error InvalidBudget();
    error InvalidDeadlines();
    error InvalidReviewPeriod();
    error IncorrectFunding();
    error DeadlinePassed();
    error DeadlineNotReached();
    error CreatorCannotApply();
    error ApplicationAlreadyExists();
    error ApplicationMissing();
    error InvalidSelection();
    error DuplicateContributor();
    error NotSelected();
    error AlreadyDelivered();
    error NothingToWithdraw();
    error InvalidRecipient();
    error TransferFailed();
    error ReentrantCall();
    error DirectPaymentDisabled();

    event JobCreated(
        uint256 indexed jobId,
        address indexed creator,
        uint256 budget,
        uint64 applicationDeadline,
        uint64 deliveryDeadline,
        string detailsRef
    );
    event JobFunded(uint256 indexed jobId, address indexed creator, uint256 amount);
    event JobCancelled(uint256 indexed jobId, address indexed creator, uint256 refundAmount);
    event ApplicationSubmitted(
        uint256 indexed jobId, address indexed applicant, string proposalRef
    );
    event ApplicationUpdated(uint256 indexed jobId, address indexed applicant, string proposalRef);
    event ContributorsSelected(uint256 indexed jobId, address[] contributors, uint256[] amounts);
    event WorkDelivered(uint256 indexed jobId, address indexed contributor, string workRef);
    event JobReadyForReview(uint256 indexed jobId, uint64 reviewDeadline);
    event JobSettled(uint256 indexed jobId, address indexed settledBy, bool creatorAccepted);
    event Withdrawal(address indexed account, address indexed recipient, uint256 amount);

    uint256 public nextJobId = 1;
    uint256 public totalEscrowLiability;
    uint256 public totalClaimableLiability;

    mapping(uint256 jobId => Job job) private jobs;
    mapping(uint256 jobId => mapping(address applicant => Application application)) private
        applications;
    mapping(uint256 jobId => address[] contributors) private selectedContributors;
    mapping(uint256 jobId => mapping(address contributor => uint256 amount)) private allocations;
    mapping(uint256 jobId => mapping(address contributor => string workRef)) private workReferences;
    mapping(address account => uint256 amount) public claimable;
    mapping(address account => uint256 count) public completedJobCount;

    uint256 private withdrawalStatus = 1;

    modifier knownJob(uint256 jobId) {
        if (jobId == 0 || jobId >= nextJobId) revert UnknownJob();
        _;
    }

    modifier nonReentrant() {
        if (withdrawalStatus != 1) revert ReentrantCall();
        withdrawalStatus = 2;
        _;
        withdrawalStatus = 1;
    }

    function createJob(
        string calldata detailsRef,
        uint256 budget,
        uint64 applicationDeadline,
        uint64 deliveryDeadline,
        uint64 reviewPeriod
    ) external payable returns (uint256 jobId) {
        if (bytes(detailsRef).length == 0) revert InvalidReference();
        if (budget == 0) revert InvalidBudget();
        if (applicationDeadline <= block.timestamp || deliveryDeadline <= applicationDeadline) {
            revert InvalidDeadlines();
        }
        if (reviewPeriod < MIN_REVIEW_PERIOD || reviewPeriod > MAX_REVIEW_PERIOD) {
            revert InvalidReviewPeriod();
        }
        if (msg.value != 0 && msg.value != budget) revert IncorrectFunding();

        jobId = nextJobId++;
        JobState initialState = msg.value == budget ? JobState.Open : JobState.Unfunded;
        jobs[jobId] = Job({
            creator: msg.sender,
            budget: budget,
            applicationDeadline: applicationDeadline,
            deliveryDeadline: deliveryDeadline,
            reviewPeriod: reviewPeriod,
            reviewDeadline: 0,
            deliveredCount: 0,
            state: initialState,
            detailsRef: detailsRef
        });

        emit JobCreated(
            jobId, msg.sender, budget, applicationDeadline, deliveryDeadline, detailsRef
        );

        if (msg.value != 0) {
            totalEscrowLiability += msg.value;
            emit JobFunded(jobId, msg.sender, msg.value);
        }
    }

    function fundJob(uint256 jobId) external payable knownJob(jobId) {
        Job storage job = jobs[jobId];
        if (msg.sender != job.creator) revert Unauthorized();
        if (job.state != JobState.Unfunded) revert InvalidState();
        if (block.timestamp >= job.applicationDeadline) revert DeadlinePassed();
        if (msg.value != job.budget) revert IncorrectFunding();

        job.state = JobState.Open;
        totalEscrowLiability += msg.value;
        emit JobFunded(jobId, msg.sender, msg.value);
    }

    function submitApplication(uint256 jobId, string calldata proposalRef)
        external
        knownJob(jobId)
    {
        Job storage job = jobs[jobId];
        if (job.state != JobState.Open) revert InvalidState();
        if (block.timestamp >= job.applicationDeadline) revert DeadlinePassed();
        if (msg.sender == job.creator) revert CreatorCannotApply();
        if (bytes(proposalRef).length == 0) revert InvalidReference();

        Application storage application = applications[jobId][msg.sender];
        if (application.exists) revert ApplicationAlreadyExists();
        application.exists = true;
        application.proposalRef = proposalRef;

        emit ApplicationSubmitted(jobId, msg.sender, proposalRef);
    }

    function updateApplication(uint256 jobId, string calldata proposalRef)
        external
        knownJob(jobId)
    {
        Job storage job = jobs[jobId];
        if (job.state != JobState.Open) revert InvalidState();
        if (block.timestamp >= job.applicationDeadline) revert DeadlinePassed();
        if (bytes(proposalRef).length == 0) revert InvalidReference();

        Application storage application = applications[jobId][msg.sender];
        if (!application.exists) revert ApplicationMissing();
        application.proposalRef = proposalRef;

        emit ApplicationUpdated(jobId, msg.sender, proposalRef);
    }

    function selectContributors(
        uint256 jobId,
        address[] calldata contributors,
        uint256[] calldata amounts
    ) external knownJob(jobId) {
        Job storage job = jobs[jobId];
        if (msg.sender != job.creator) revert Unauthorized();
        if (job.state != JobState.Open) revert InvalidState();
        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();

        uint256 length = contributors.length;
        if (length == 0 || length > MAX_CONTRIBUTORS || length != amounts.length) {
            revert InvalidSelection();
        }

        uint256 selectedTotal;
        for (uint256 i; i < length; ++i) {
            address contributor = contributors[i];
            uint256 amount = amounts[i];
            if (contributor == address(0) || amount == 0) revert InvalidSelection();
            if (!applications[jobId][contributor].exists) revert ApplicationMissing();
            if (allocations[jobId][contributor] != 0) revert DuplicateContributor();

            allocations[jobId][contributor] = amount;
            selectedContributors[jobId].push(contributor);
            selectedTotal += amount;
        }

        if (selectedTotal != job.budget) revert InvalidSelection();
        job.state = JobState.Selected;
        emit ContributorsSelected(jobId, contributors, amounts);
    }

    function deliverWork(uint256 jobId, string calldata workRef) external knownJob(jobId) {
        Job storage job = jobs[jobId];
        if (job.state != JobState.Selected) revert InvalidState();
        if (block.timestamp >= job.deliveryDeadline) revert DeadlinePassed();
        if (allocations[jobId][msg.sender] == 0) revert NotSelected();
        if (bytes(workRef).length == 0) revert InvalidReference();
        if (bytes(workReferences[jobId][msg.sender]).length != 0) revert AlreadyDelivered();

        workReferences[jobId][msg.sender] = workRef;
        unchecked {
            ++job.deliveredCount;
        }
        emit WorkDelivered(jobId, msg.sender, workRef);

        if (job.deliveredCount == selectedContributors[jobId].length) {
            job.state = JobState.Delivered;
            job.reviewDeadline = uint64(block.timestamp) + job.reviewPeriod;
            emit JobReadyForReview(jobId, job.reviewDeadline);
        }
    }

    function acceptJob(uint256 jobId) external knownJob(jobId) {
        Job storage job = jobs[jobId];
        if (msg.sender != job.creator) revert Unauthorized();
        if (job.state != JobState.Delivered) revert InvalidState();
        _settle(jobId, job, true);
    }

    function finalizeJob(uint256 jobId) external knownJob(jobId) {
        Job storage job = jobs[jobId];
        if (job.state != JobState.Delivered) revert InvalidState();
        if (block.timestamp < job.reviewDeadline) revert DeadlineNotReached();
        _settle(jobId, job, false);
    }

    function cancelJob(uint256 jobId) external knownJob(jobId) {
        Job storage job = jobs[jobId];
        if (msg.sender != job.creator) revert Unauthorized();

        JobState state = job.state;
        if (state == JobState.Selected) {
            if (block.timestamp < job.deliveryDeadline) revert DeadlineNotReached();
            if (job.deliveredCount == selectedContributors[jobId].length) revert InvalidState();
        } else if (state != JobState.Unfunded && state != JobState.Open) {
            revert InvalidState();
        }

        job.state = JobState.Cancelled;
        uint256 refundAmount;
        if (state != JobState.Unfunded) {
            refundAmount = job.budget;
            totalEscrowLiability -= refundAmount;
            totalClaimableLiability += refundAmount;
            claimable[job.creator] += refundAmount;
        }

        emit JobCancelled(jobId, job.creator, refundAmount);
    }

    function withdraw(address payable recipient) external nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        claimable[msg.sender] = 0;
        totalClaimableLiability -= amount;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, recipient, amount);
    }

    function getJob(uint256 jobId) external view knownJob(jobId) returns (Job memory) {
        return jobs[jobId];
    }

    function getApplication(uint256 jobId, address applicant)
        external
        view
        knownJob(jobId)
        returns (bool exists, string memory proposalRef)
    {
        Application storage application = applications[jobId][applicant];
        return (application.exists, application.proposalRef);
    }

    function getSelectedContributors(uint256 jobId)
        external
        view
        knownJob(jobId)
        returns (address[] memory)
    {
        return selectedContributors[jobId];
    }

    function allocationOf(uint256 jobId, address contributor)
        external
        view
        knownJob(jobId)
        returns (uint256)
    {
        return allocations[jobId][contributor];
    }

    function workReferenceOf(uint256 jobId, address contributor)
        external
        view
        knownJob(jobId)
        returns (string memory)
    {
        return workReferences[jobId][contributor];
    }

    function _settle(uint256 jobId, Job storage job, bool creatorAccepted) private {
        job.state = JobState.Settled;
        totalEscrowLiability -= job.budget;
        totalClaimableLiability += job.budget;

        address[] storage contributors = selectedContributors[jobId];
        uint256 length = contributors.length;
        for (uint256 i; i < length; ++i) {
            address contributor = contributors[i];
            claimable[contributor] += allocations[jobId][contributor];
            unchecked {
                ++completedJobCount[contributor];
            }
        }

        emit JobSettled(jobId, msg.sender, creatorAccepted);
    }

    receive() external payable {
        revert DirectPaymentDisabled();
    }
}
