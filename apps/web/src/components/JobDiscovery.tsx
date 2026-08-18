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

function isReference(value: string) {
  return /^(https?:\/\/|ipfs:\/\/)/i.test(value);
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
              <p className="job-description">{job.detailsRef}</p>
              {isReference(job.detailsRef) && (
                <a href={job.detailsRef} target="_blank" rel="noreferrer">
                  Open reference ↗
                </a>
              )}
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
              {!isCreator && (
                <form
                  className="application-form"
                  onSubmit={(event) => submit(event, job)}
                >
                  <label className="field">
                    <span>
                      {job.application?.exists
                        ? 'Update application'
                        : 'Apply to this job'}
                    </span>
                    <textarea
                      rows={3}
                      required
                      placeholder="Tell the creator how you will approach the work."
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
                    disabled={
                      !connectedAccount || !accepting || pendingJobId === job.id
                    }
                  >
                    {pendingJobId === job.id
                      ? 'Confirming…'
                      : job.application?.exists
                        ? 'Update application'
                        : 'Apply now'}
                  </button>
                  {!accepting && (
                    <p className="form-note">
                      Applications are closed for this job.
                    </p>
                  )}
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
