import { useState, type FormEvent } from 'react';
import { formatEther } from 'viem';

export type JobView = {
  id: bigint;
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

type Props = {
  jobs: JobView[];
  loading: boolean;
  connectedAccount?: string;
  pendingJobId?: bigint;
  error?: string;
  explorerUrl: string;
  onRefresh(): Promise<void>;
  onApply(jobId: bigint, proposalRef: string, update: boolean): Promise<void>;
};

const stateLabels = [
  'Unfunded',
  'Open',
  'Selected',
  'Delivered',
  'Settled',
  'Cancelled',
];

function formatDate(seconds: bigint) {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

export function JobDiscovery({
  jobs,
  loading,
  connectedAccount,
  pendingJobId,
  error,
  explorerUrl,
  onRefresh,
  onApply,
}: Props) {
  const [proposals, setProposals] = useState<Record<string, string>>({});

  function submit(event: FormEvent<HTMLFormElement>, job: JobView) {
    event.preventDefault();
    const proposal =
      proposals[job.id.toString()]?.trim() ||
      job.application?.proposalRef ||
      '';
    if (!proposal) return;
    void onApply(job.id, proposal, Boolean(job.application?.exists));
  }

  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div className="composer-heading">
        <div>
          <p className="label">Public marketplace</p>
          <h2 id="discovery-title">Open jobs</h2>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && jobs.length === 0 && (
        <div className="empty-state">
          <strong>No jobs posted yet</strong>
          <p>
            The first funded job will appear here after its transaction
            confirms.
          </p>
        </div>
      )}
      <div className="job-list">
        {jobs.map((job) => {
          const accepting =
            job.state === 1 &&
            job.applicationDeadline * 1000n > BigInt(Date.now());
          const isCreator =
            connectedAccount?.toLowerCase() === job.creator.toLowerCase();
          return (
            <article className="job-item" key={job.id.toString()}>
              <div className="job-meta">
                <span>JOB #{job.id.toString()}</span>
                <span>{stateLabels[job.state] ?? 'Unknown'}</span>
              </div>
              <h3>{formatEther(job.budget)} BOT</h3>
              <a href={job.detailsRef} target="_blank" rel="noreferrer">
                Open job details ↗
              </a>
              <dl>
                <div>
                  <dt>Applications close</dt>
                  <dd>{formatDate(job.applicationDeadline)}</dd>
                </div>
                <div>
                  <dt>Delivery due</dt>
                  <dd>{formatDate(job.deliveryDeadline)}</dd>
                </div>
                <div>
                  <dt>Creator</dt>
                  <dd>
                    <a
                      href={`${explorerUrl}/address/${job.creator}`}
                      target="_blank"
                      rel="noreferrer"
                    >{`${job.creator.slice(0, 6)}…${job.creator.slice(-4)}`}</a>
                  </dd>
                </div>
              </dl>
              {accepting && !isCreator && (
                <form
                  className="application-form"
                  onSubmit={(event) => submit(event, job)}
                >
                  <label className="field">
                    <span>
                      {job.application?.exists
                        ? 'Update proposal reference'
                        : 'Proposal reference'}
                    </span>
                    <input
                      type="url"
                      required
                      placeholder="https://… or ipfs://…"
                      value={
                        proposals[job.id.toString()] ??
                        job.application?.proposalRef ??
                        ''
                      }
                      onChange={(event) =>
                        setProposals((current) => ({
                          ...current,
                          [job.id.toString()]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!connectedAccount || pendingJobId === job.id}
                  >
                    {pendingJobId === job.id
                      ? 'Confirming…'
                      : job.application?.exists
                        ? 'Update application'
                        : 'Apply'}
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
