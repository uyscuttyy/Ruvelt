import { useState, type FormEvent } from 'react';
import { formatEther } from 'viem';

type Job = {
  id: bigint;
  creator: string;
  budget: bigint;
  state: number;
  selectedContributors?: string[];
  contributorAllocation?: bigint;
  workReference?: string;
};
type Props = {
  account?: string;
  jobs: Job[];
  claimable: bigint;
  pendingJobId?: bigint;
  error?: string;
  onDeliver(id: bigint, ref: string): Promise<void>;
  onAccept(id: bigint): Promise<void>;
  onFinalize(id: bigint): Promise<void>;
  onCancel(id: bigint): Promise<void>;
  onWithdraw(): Promise<void>;
};

export function SettlementActions({
  account,
  jobs,
  claimable,
  pendingJobId,
  error,
  onDeliver,
  onAccept,
  onFinalize,
  onCancel,
  onWithdraw,
}: Props) {
  const [refs, setRefs] = useState<Record<string, string>>({});
  const selected = jobs.filter(
    (job) =>
      job.state === 2 &&
      job.selectedContributors?.some(
        (contributor) => contributor.toLowerCase() === account?.toLowerCase(),
      ),
  );
  const review = jobs.filter(
    (job) =>
      job.state === 3 && job.creator.toLowerCase() === account?.toLowerCase(),
  );
  const incomplete = jobs.filter(
    (job) =>
      job.state === 2 && job.creator.toLowerCase() === account?.toLowerCase(),
  );
  if (!account) return null;
  return (
    <section className="settlement" aria-labelledby="settlement-title">
      <div className="composer-heading">
        <div>
          <p className="label">Protocol actions</p>
          <h2 id="settlement-title">Deliver and settle</h2>
        </div>
        <span className="phase">PHASE 10</span>
      </div>
      {selected.map((job) => (
        <form
          className="action-row"
          key={`deliver-${job.id}`}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const ref = refs[job.id.toString()]?.trim();
            if (ref) void onDeliver(job.id, ref);
          }}
        >
          <div>
            <strong>Job #{job.id.toString()}</strong>
            <p>Allocated {formatEther(job.contributorAllocation ?? 0n)} BOT</p>
          </div>
          <input
            type="url"
            required
            placeholder="Work reference"
            value={refs[job.id.toString()] ?? ''}
            onChange={(event) =>
              setRefs((current) => ({
                ...current,
                [job.id.toString()]: event.target.value,
              }))
            }
          />
          <button type="submit" disabled={pendingJobId === job.id}>
            {pendingJobId === job.id ? 'Confirming…' : 'Deliver work'}
          </button>
        </form>
      ))}
      {review.map((job) => (
        <div className="action-row" key={`accept-${job.id}`}>
          <div>
            <strong>Job #{job.id.toString()}</strong>
            <p>All contributors delivered.</p>
          </div>
          <button
            type="button"
            disabled={pendingJobId === job.id}
            onClick={() => void onAccept(job.id)}
          >
            Accept and settle
          </button>
          <button
            className="button-secondary"
            type="button"
            disabled={pendingJobId === job.id}
            onClick={() => void onFinalize(job.id)}
          >
            Finalize
          </button>
        </div>
      ))}
      {incomplete.map((job) => (
        <div className="action-row" key={`cancel-${job.id}`}>
          <div>
            <strong>Job #{job.id.toString()}</strong>
            <p>Selection is incomplete.</p>
          </div>
          <button
            className="button-secondary"
            type="button"
            onClick={() => void onCancel(job.id)}
          >
            Cancel after deadline
          </button>
        </div>
      ))}
      <div className="withdraw-row">
        <div>
          <p className="label">Claimable balance</p>
          <strong>{formatEther(claimable)} BOT</strong>
        </div>
        <button
          type="button"
          disabled={claimable === 0n}
          onClick={() => void onWithdraw()}
        >
          Withdraw to wallet
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
