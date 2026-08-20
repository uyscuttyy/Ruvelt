import { formatEther } from 'viem';
import { useEffect, useState } from 'react';
import type { JobView } from './JobTypes';

type Props = {
  jobs: JobView[];
  loading: boolean;
  preview?: boolean;
  connectedAccount?: string;
  preserveOrder?: boolean;
};

function actionFor(job: JobView) {
  if (job.state === 4) return { label: 'Settled', active: false };
  if (job.state === 1 && job.applicationDeadline * 1000n > BigInt(Date.now())) {
    return { label: 'Apply', active: true };
  }
  return { label: 'Application closed', active: false };
}

function shortTitle(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean.length > 78 ? `${clean.slice(0, 78)}…` : clean || 'Untitled job';
}

export function JobRow({
  job,
  connectedAccount,
}: {
  job: JobView;
  connectedAccount?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const action = actionFor(job);
  const selected = Boolean(
    connectedAccount &&
      job.selectedContributors?.some(
        (contributor) =>
          contributor.toLowerCase() === connectedAccount.toLowerCase(),
      ),
  );
  const relationship = selected
    ? `Selected contributor · ${job.contributorAllocation ? formatEther(job.contributorAllocation) : '0'} BOT allocated`
    : job.application?.exists
      ? 'Application submitted'
      : 'No application from this wallet';
  return (
    <>
      <button
        className="job-card"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View job: ${job.detailsRef}`}
      >
        <div className="job-row-main">
          <strong className="job-row-title">
            {shortTitle(job.detailsRef)}
          </strong>
          <span className="job-row-amount">{formatEther(job.budget)} BOT</span>
          <span className={`job-row-status state-${job.state}`}>
            {action.label}
          </span>
          <div className="job-card-preview" aria-hidden="true">
            <span>
              Applications close:{' '}
              {new Date(
                Number(job.applicationDeadline) * 1000,
              ).toLocaleString()}
            </span>
            <span>
              Delivery:{' '}
              {new Date(Number(job.deliveryDeadline) * 1000).toLocaleString()}
            </span>
            <span>Click to view full job</span>
          </div>
        </div>
      </button>
      {open && (
        <div
          className="job-modal-backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="job-modal"
            role="dialog"
            aria-modal="true"
            aria-label={job.detailsRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="job-modal-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close job details"
            >
              ×
            </button>
            <p className="landing-kicker">Job #{job.id.toString()}</p>
            <h2>{job.detailsRef}</h2>
            <div className="job-modal-summary">
              <strong>{formatEther(job.budget)} BOT</strong>
              <span>{action.label}</span>
            </div>
            <p className="job-modal-label">Job brief</p>
            <p className="job-modal-copy">{job.detailsRef}</p>
            <dl className="job-modal-facts">
              <div>
                <dt>Applications close</dt>
                <dd>
                  {new Date(
                    Number(job.applicationDeadline) * 1000,
                  ).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Delivery due</dt>
                <dd>
                  {new Date(
                    Number(job.deliveryDeadline) * 1000,
                  ).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Wallet status</dt>
                <dd>{relationship}</dd>
              </div>
            </dl>
            <a className="job-modal-link" href={`/jobs/${job.id.toString()}`}>
              View full job and application →
            </a>
          </section>
        </div>
      )}
    </>
  );
}

export function JobDiscovery({
  jobs,
  loading,
  preview = false,
  connectedAccount,
  preserveOrder = false,
}: Props) {
  const ordered = preserveOrder
    ? jobs
    : [...jobs].sort((a, b) => Number(b.createdAt - a.createdAt));
  const visible = preview ? ordered.slice(0, 4) : ordered;
  return (
    <section className="discovery" aria-labelledby="discovery-title">
      {!preview && <h2 id="discovery-title">Jobs</h2>}
      {loading ? (
        <p className="job-empty">Loading jobs…</p>
      ) : visible.length === 0 ? (
        <p className="job-empty">No jobs have been posted yet.</p>
      ) : (
        <div className="job-list">
          {visible.map((job) => (
            <JobRow
              job={job}
              connectedAccount={connectedAccount}
              key={job.id.toString()}
            />
          ))}
        </div>
      )}
      {preview && (
        <a className="view-all-jobs" href="/jobs">
          View all jobs →
        </a>
      )}
    </section>
  );
}
