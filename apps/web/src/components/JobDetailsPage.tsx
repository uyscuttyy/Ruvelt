import { formatEther } from 'viem';
import type { JobView } from './JobTypes';

type Props = {
  job?: JobView;
  onApply(jobId: bigint, proposalRef: string, update: boolean): Promise<void>;
  account?: string;
  pending?: boolean;
};

export function JobDetailsPage({ job, onApply, account, pending }: Props) {
  if (!job)
    return (
      <main className="job-details-page">
        <a href="/jobs">← Back to jobs</a>
        <h1>Job not found</h1>
      </main>
    );
  const open =
    job.state === 1 && job.applicationDeadline * 1000n > BigInt(Date.now());
  const settled = job.state === 4;
  return (
    <main className="job-details-page">
      <a className="jobs-back" href="/jobs">
        ← Back to jobs
      </a>
      <p className="landing-kicker">Job #{job.id.toString()}</p>
      <h1>{job.detailsRef}</h1>
      <div className="job-details-layout">
        <section>
          <p className="job-detail-status">
            {settled
              ? 'Settled'
              : open
                ? 'Accepting applications'
                : 'Application closed'}
          </p>
          <p className="job-detail-description">{job.detailsRef}</p>
          <h2>Participation</h2>
          <p>
            Applications are open to contributors with a connected BOT Chain
            wallet while the job is open.
          </p>
          {open && account ? (
            <form
              className="job-apply-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const proposal = String(form.get('proposal') || '').trim();
                if (proposal)
                  void onApply(
                    job.id,
                    proposal,
                    Boolean(job.application?.exists),
                  );
              }}
            >
              <label>
                Application proposal
                <textarea
                  name="proposal"
                  required
                  rows={6}
                  defaultValue={job.application?.proposalRef || ''}
                  placeholder="Explain how you will approach the work."
                />
              </label>
              <button type="submit" disabled={pending}>
                {pending
                  ? 'Confirming…'
                  : job.application?.exists
                    ? 'Update application'
                    : 'Apply for this job'}
              </button>
            </form>
          ) : (
            <p className="job-detail-note">
              {settled
                ? 'This job has already settled.'
                : open
                  ? 'Connect a wallet to apply.'
                  : 'Applications are closed for this job.'}
            </p>
          )}
        </section>
        <aside className="job-details-facts">
          <div>
            <span>Status</span>
            <strong>{settled ? 'Settled' : open ? 'Open' : 'Closed'}</strong>
          </div>
          <div>
            <span>Budget</span>
            <strong>{formatEther(job.budget)} BOT</strong>
          </div>
          <div>
            <span>Applications close</span>
            <strong>
              {new Date(
                Number(job.applicationDeadline) * 1000,
              ).toLocaleString()}
            </strong>
          </div>
          <div>
            <span>Delivery due</span>
            <strong>
              {new Date(Number(job.deliveryDeadline) * 1000).toLocaleString()}
            </strong>
          </div>
          <div>
            <span>Creator</span>
            <strong>{`${job.creator.slice(0, 8)}…${job.creator.slice(-6)}`}</strong>
          </div>
        </aside>
      </div>
    </main>
  );
}
