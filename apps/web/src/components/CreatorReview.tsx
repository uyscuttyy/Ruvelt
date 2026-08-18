import { useState, type FormEvent } from 'react';
import { parseEther } from 'viem';

export type ApplicationView = { applicant: string; proposalRef: string };
export type ReviewJob = {
  id: bigint;
  creator: string;
  budget: bigint;
  state: number;
  applications: ApplicationView[];
};

type Props = {
  account?: string;
  jobs: ReviewJob[];
  pendingJobId?: bigint;
  error?: string;
  explorerUrl: string;
  onSelect(
    jobId: bigint,
    contributors: string[],
    amounts: bigint[],
  ): Promise<void>;
};

export function CreatorReview({
  account,
  jobs,
  pendingJobId,
  error,
  explorerUrl,
  onSelect,
}: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  function submit(event: FormEvent<HTMLFormElement>, job: ReviewJob) {
    event.preventDefault();
    const chosen = job.applications.filter(
      (application) => selected[`${job.id}:${application.applicant}`],
    );
    const contributors = chosen.map((application) => application.applicant);
    const allocations = chosen.map((application) =>
      parseEther(amounts[`${job.id}:${application.applicant}`] || '0'),
    );
    if (contributors.length > 0)
      void onSelect(job.id, contributors, allocations);
  }

  const creatorJobs = jobs.filter(
    (job) =>
      job.creator.toLowerCase() === account?.toLowerCase() &&
      job.state === 1 &&
      job.applications.length > 0,
  );
  if (!account || creatorJobs.length === 0) return null;

  return (
    <section className="review" aria-labelledby="review-title">
      <div className="composer-heading">
        <div>
          <p className="label">Creator workflow</p>
          <h2 id="review-title">Review applicants</h2>
        </div>
        <span className="phase">PHASE 9</span>
      </div>
      {creatorJobs.map((job) => (
        <form
          className="review-job"
          key={job.id.toString()}
          onSubmit={(event) => submit(event, job)}
        >
          <div className="job-meta">
            <span>JOB #{job.id.toString()}</span>
            <span>Budget {Number(job.budget) / 1e18} BOT</span>
          </div>
          {job.applications.map((application) => {
            const key = `${job.id}:${application.applicant}`;
            return (
              <label className="applicant" key={application.applicant}>
                <input
                  type="checkbox"
                  checked={Boolean(selected[key])}
                  onChange={(event) =>
                    setSelected((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                <span className="applicant-copy">
                  <strong>{`${application.applicant.slice(0, 8)}…${application.applicant.slice(-6)}`}</strong>
                  <a
                    href={application.proposalRef}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View proposal ↗
                  </a>
                </span>
                <span className="input-unit">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={amounts[key] ?? ''}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  <b>BOT</b>
                </span>
              </label>
            );
          })}
          <button type="submit" disabled={pendingJobId === job.id}>
            {' '}
            {pendingJobId === job.id
              ? 'Confirming…'
              : 'Select contributors'}{' '}
          </button>
        </form>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
