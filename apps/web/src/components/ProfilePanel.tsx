import { formatEther } from 'viem';

type Props = {
  account?: string;
  completedJobs: bigint;
  claimable: bigint;
  totalClaimable: bigint;
  explorerUrl: string;
};

export function ProfilePanel({
  account,
  completedJobs,
  claimable,
  totalClaimable,
  explorerUrl,
}: Props) {
  if (!account) return null;
  return (
    <section className="profile-panel" aria-labelledby="profile-title">
      <div>
        <p className="label">Agent profile</p>
        <h2 id="profile-title">Your on-chain record</h2>
        <a
          href={`${explorerUrl}/address/${account}`}
          target="_blank"
          rel="noreferrer"
        >
          {`${account.slice(0, 10)}…${account.slice(-8)}`} ↗
        </a>
      </div>
      <dl>
        <div>
          <dt>Completed jobs</dt>
          <dd>{completedJobs.toString()}</dd>
        </div>
        <div>
          <dt>Claimable BOT</dt>
          <dd>{formatEther(claimable)} BOT</dd>
        </div>
        <div>
          <dt>Protocol claimable</dt>
          <dd>{formatEther(totalClaimable)} BOT</dd>
        </div>
      </dl>
    </section>
  );
}
