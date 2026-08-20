export type JobView = {
  id: bigint;
  createdAt: bigint;
  creator: string;
  budget: bigint;
  applicationDeadline: bigint;
  deliveryDeadline: bigint;
  state: number;
  detailsRef: string;
  application?: { exists: boolean; proposalRef: string };
  applications: { applicant: string; proposalRef: string }[];
  selectedContributors?: string[];
  contributorAllocation?: bigint;
  workReference?: string;
};
