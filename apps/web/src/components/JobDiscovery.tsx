import { formatEther } from 'viem';
import { useState } from 'react';
import type { JobView } from './JobTypes';

type Props = {
  jobs: JobView[];
  loading: boolean;
  preview?: boolean;
  connectedAccount?: string;
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
    <div
      className="job-row"
      tabIndex={0}
      aria-label={`Inspect job: ${job.detailsRef}`}
    >
      <div className="job-row-main">
        <strong className="job-row-title">{shortTitle(job.detailsRef)}</strong>
        <span className="job-row-amount">{formatEther(job.budget)} BOT</span>
        {action.active ? (
          <a
            className="job-row-action"
            href={`/jobs/${job.id.toString()}`}
            onClick={(event) => event.stopPropagation()}
          >
            {action.label} <span aria-hidden="true">→</span>
          </a>
        ) : (
          <span className={`job-row-status state-${job.state}`}>
            {action.label}
          </span>
        )}
      </div>
      <div className="job-row-tooltip" role="tooltip">
        <strong>{job.detailsRef}</strong>
        <p>{relationship}</p>
        <dl>
          <div>
            <dt>Budget</dt>
            <dd>{formatEther(job.budget)} BOT</dd>
          </div>
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
              {new Date(Number(job.deliveryDeadline) * 1000).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{action.label}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function JobDiscovery({
  jobs,
  loading,
  preview = false,
  connectedAccount,
}: Props) {
  const ordered = [...jobs].sort((a, b) => Number(b.createdAt - a.createdAt));
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
