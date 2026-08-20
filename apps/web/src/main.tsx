import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  parseAbiItem,
  parseEther,
  type Address,
  type EIP1193Provider,
} from 'viem';
import { CreateJobForm, type CreateJobInput } from './components/CreateJobForm';
import { JobDiscovery } from './components/JobDiscovery';
import type { JobView } from './components/JobTypes';
import { CreatorReview, type ReviewJob } from './components/CreatorReview';
import { ProfilePanel } from './components/ProfilePanel';
import { SettlementActions } from './components/SettlementActions';
import { LandingPage } from './components/LandingPage';
import { JobsPage } from './components/JobsPage';
import { JobDetailsPage } from './components/JobDetailsPage';
import { ruveltJobsAbi } from './contracts/RuveltJobs.abi';
import './styles.css';

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(
    event: 'accountsChanged' | 'chainChanged',
    listener: (value: unknown) => void,
  ): void;
  removeListener?(
    event: 'accountsChanged' | 'chainChanged',
    listener: (value: unknown) => void,
  ): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const config = {
  chainId: Number(import.meta.env.VITE_BOT_CHAIN_ID || 968),
  chainName: import.meta.env.VITE_BOT_CHAIN_NAME || 'BOT Chain Testnet',
  rpcUrl: import.meta.env.VITE_BOT_RPC_URL || 'https://rpc.bohr.life',
  explorerUrl:
    import.meta.env.VITE_BOT_BLOCK_EXPLORER_URL || 'https://www.botscans.net',
  contractAddress:
    import.meta.env.VITE_RUVELT_CONTRACT_ADDRESS ||
    '0xf13ad20A3e912978Ab683b95AAdD9832d008ae0c',
};

const botChain = defineChain({
  id: config.chainId,
  name: config.chainName,
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: { default: { name: 'BOT Scan', url: config.explorerUrl } },
});

const publicClient = createPublicClient({
  chain: botChain,
  transport: http(config.rpcUrl),
});
const applicationSubmittedEvent = parseAbiItem(
  'event ApplicationSubmitted(uint256 indexed jobId, address indexed applicant, string proposalRef)',
);
const jobCreatedEvent = parseAbiItem(
  'event JobCreated(uint256 indexed jobId, address indexed creator, uint256 budget, uint64 applicationDeadline, uint64 deliveryDeadline, string detailsRef)',
);

function MarketplaceApp() {
  const [network, setNetwork] = useState<'checking' | 'online' | 'offline'>(
    'checking',
  );
  const [rpcChainId, setRpcChainId] = useState<number>();
  const [account, setAccount] = useState<string>();
  const [walletChainId, setWalletChainId] = useState<number>();
  const [balance, setBalance] = useState<string>();
  const [walletStatus, setWalletStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'unsupported' | 'error'
  >(window.ethereum ? 'idle' : 'unsupported');
  const [walletMessage, setWalletMessage] = useState('');
  const [jobPending, setJobPending] = useState(false);
  const [jobError, setJobError] = useState('');
  const [jobTransactionHash, setJobTransactionHash] = useState<string>();
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [applicationPendingJobId, setApplicationPendingJobId] =
    useState<bigint>();
  const [selectionError, setSelectionError] = useState('');
  const [completedJobs, setCompletedJobs] = useState(0n);
  const [claimableBalance, setClaimableBalance] = useState(0n);
  const [totalClaimable, setTotalClaimable] = useState(0n);
  const [settlementError, setSettlementError] = useState('');

  useEffect(() => {
    fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('RPC unavailable');
        const payload = (await response.json()) as { result?: string };
        if (!payload.result) throw new Error('Invalid RPC response');
        setRpcChainId(Number.parseInt(payload.result, 16));
        setNetwork('online');
      })
      .catch(() => setNetwork('offline'));
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;

    const updateAccounts = (value: unknown) => {
      const accounts = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
      setAccount(accounts[0]);
      setWalletStatus(accounts[0] ? 'connected' : 'idle');
    };
    const updateChain = (value: unknown) => {
      if (typeof value === 'string')
        setWalletChainId(Number.parseInt(value, 16));
    };

    void provider.request({ method: 'eth_accounts' }).then(updateAccounts);
    void provider.request({ method: 'eth_chainId' }).then(updateChain);
    provider.on?.('accountsChanged', updateAccounts);
    provider.on?.('chainChanged', updateChain);

    return () => {
      provider.removeListener?.('accountsChanged', updateAccounts);
      provider.removeListener?.('chainChanged', updateChain);
    };
  }, []);

  useEffect(() => {
    if (!account || !window.ethereum) {
      setBalance(undefined);
      return;
    }
    void window.ethereum
      .request({ method: 'eth_getBalance', params: [account, 'latest'] })
      .then((value) => {
        if (typeof value === 'string') {
          const bot = Number(BigInt(value)) / 1e18;
          setBalance(
            bot.toLocaleString(undefined, { maximumFractionDigits: 4 }),
          );
        }
      })
      .catch(() => setBalance(undefined));
  }, [account, walletChainId]);

  useEffect(() => {
    void loadJobs();
    void loadProfile();
  }, [account]);

  async function switchToBotChain(provider: EthereumProvider) {
    const chainId = `0x${config.chainId.toString(16)}`;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId,
            chainName: config.chainName,
            nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.explorerUrl],
          },
        ],
      });
    }
  }

  async function connectWallet() {
    const provider = window.ethereum;
    if (!provider) {
      setWalletStatus('unsupported');
      setWalletMessage('Install an EVM-compatible browser wallet to continue.');
      return;
    }

    setWalletStatus('connecting');
    setWalletMessage('');
    try {
      await switchToBotChain(provider);
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const chain = (await provider.request({
        method: 'eth_chainId',
      })) as string;
      setAccount(accounts[0]);
      setWalletChainId(Number.parseInt(chain, 16));
      setWalletStatus(accounts[0] ? 'connected' : 'idle');
    } catch (error) {
      setWalletStatus('error');
      setWalletMessage(
        (error as { message?: string }).message ||
          'Wallet connection was cancelled.',
      );
    }
  }

  async function disconnectWallet() {
    const provider = window.ethereum;
    setAccount(undefined);
    setWalletChainId(undefined);
    setBalance(undefined);
    setWalletStatus(provider ? 'idle' : 'unsupported');
    setWalletMessage('Wallet disconnected from this session.');
    try {
      await provider?.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some injected wallets do not support permission revocation; local state
      // is still cleared and accountsChanged remains the source of truth.
    }
  }

  async function createJob(input: CreateJobInput) {
    const provider = window.ethereum;
    if (!provider || !account) {
      setJobError('Connect a wallet before posting a job.');
      return;
    }

    setJobPending(true);
    setJobError('');
    setJobTransactionHash(undefined);

    try {
      await switchToBotChain(provider);
      const walletClient = createWalletClient({
        account: account as Address,
        chain: botChain,
        transport: custom(provider as EIP1193Provider),
      });
      const hash = await walletClient.writeContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: 'createJob',
        args: [
          input.detailsRef,
          parseEther(input.budget),
          input.applicationDeadline,
          input.deliveryDeadline,
          input.reviewPeriod,
        ],
        value: parseEther(input.budget),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success')
        throw new Error('The job transaction reverted.');
      setJobTransactionHash(hash);
      await loadJobs();
    } catch (error) {
      setJobError(
        (error as { shortMessage?: string; message?: string }).shortMessage ||
          (error as { message?: string }).message ||
          'Unable to create the job.',
      );
    } finally {
      setJobPending(false);
    }
  }

  async function loadJobs() {
    setJobsLoading(true);
    setJobsError('');
    try {
      const nextJobId = await publicClient.readContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: 'nextJobId',
      });
      const ids = Array.from({ length: Number(nextJobId - 1n) }, (_, index) =>
        BigInt(index + 1),
      );
      const loaded = await Promise.all(
        ids.map(async (id): Promise<JobView> => {
          const job = await publicClient.readContract({
            address: config.contractAddress as Address,
            abi: ruveltJobsAbi,
            functionName: 'getJob',
            args: [id],
          });
          const application = account
            ? await publicClient.readContract({
                address: config.contractAddress as Address,
                abi: ruveltJobsAbi,
                functionName: 'getApplication',
                args: [id, account as Address],
              })
            : undefined;
          const applicationLogs = await publicClient.getLogs({
            address: config.contractAddress as Address,
            event: applicationSubmittedEvent,
            args: { jobId: id },
            fromBlock: 0n,
          });
          const createdLogs = await publicClient.getLogs({
            address: config.contractAddress as Address,
            event: jobCreatedEvent,
            args: { jobId: id },
            fromBlock: 0n,
          });
          const createdBlock = createdLogs[0]?.blockNumber;
          const createdAt = createdBlock
            ? (await publicClient.getBlock({ blockNumber: createdBlock }))
                .timestamp
            : 0n;
          const selectedContributors =
            job.state >= 2 && job.state <= 3
              ? await publicClient.readContract({
                  address: config.contractAddress as Address,
                  abi: ruveltJobsAbi,
                  functionName: 'getSelectedContributors',
                  args: [id],
                })
              : [];
          const contributorAllocation =
            account &&
            selectedContributors.some(
              (item) => item.toLowerCase() === account.toLowerCase(),
            )
              ? await publicClient.readContract({
                  address: config.contractAddress as Address,
                  abi: ruveltJobsAbi,
                  functionName: 'allocationOf',
                  args: [id, account as Address],
                })
              : undefined;
          const workReference =
            account &&
            selectedContributors.some(
              (item) => item.toLowerCase() === account.toLowerCase(),
            )
              ? await publicClient.readContract({
                  address: config.contractAddress as Address,
                  abi: ruveltJobsAbi,
                  functionName: 'workReferenceOf',
                  args: [id, account as Address],
                })
              : undefined;
          return {
            id,
            createdAt,
            creator: job.creator,
            budget: job.budget,
            applicationDeadline: job.applicationDeadline,
            deliveryDeadline: job.deliveryDeadline,
            state: job.state,
            detailsRef: job.detailsRef,
            ...(application
              ? {
                  application: {
                    exists: application[0],
                    proposalRef: application[1],
                  },
                }
              : {}),
            applications: applicationLogs.map((log) => ({
              applicant: log.args.applicant as string,
              proposalRef: log.args.proposalRef as string,
            })),
            selectedContributors: [...selectedContributors],
            contributorAllocation,
            workReference,
          };
        }),
      );
      setJobs(loaded.reverse());
    } catch (error) {
      setJobsError(
        (error as { shortMessage?: string; message?: string }).shortMessage ||
          (error as { message?: string }).message ||
          'Unable to load jobs.',
      );
    } finally {
      setJobsLoading(false);
    }
  }

  async function loadProfile() {
    const protocolTotal = await publicClient.readContract({
      address: config.contractAddress as Address,
      abi: ruveltJobsAbi,
      functionName: 'totalClaimableLiability',
    });
    setTotalClaimable(protocolTotal);
    if (!account) {
      setCompletedJobs(0n);
      setClaimableBalance(0n);
      return;
    }
    const [completed, claimable] = await Promise.all([
      publicClient.readContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: 'completedJobCount',
        args: [account as Address],
      }),
      publicClient.readContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: 'claimable',
        args: [account as Address],
      }),
    ]);
    setCompletedJobs(completed);
    setClaimableBalance(claimable);
  }

  async function applyToJob(
    jobId: bigint,
    proposalRef: string,
    update: boolean,
  ) {
    const provider = window.ethereum;
    if (!provider || !account) {
      setJobsError('Connect a wallet before applying.');
      return;
    }
    setApplicationPendingJobId(jobId);
    setJobsError('');
    try {
      await switchToBotChain(provider);
      const walletClient = createWalletClient({
        account: account as Address,
        chain: botChain,
        transport: custom(provider as EIP1193Provider),
      });
      const hash = await walletClient.writeContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: update ? 'updateApplication' : 'submitApplication',
        args: [jobId, proposalRef],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success')
        throw new Error('The application transaction reverted.');
      await loadJobs();
    } catch (error) {
      setJobsError(
        (error as { shortMessage?: string; message?: string }).shortMessage ||
          (error as { message?: string }).message ||
          'Unable to submit the application.',
      );
    } finally {
      setApplicationPendingJobId(undefined);
    }
  }

  async function selectContributors(
    jobId: bigint,
    contributors: string[],
    amounts: bigint[],
  ) {
    const provider = window.ethereum;
    if (!provider || !account) return;
    const job = jobs.find((item) => item.id === jobId);
    if (
      !job ||
      amounts.reduce((total, amount) => total + amount, 0n) !== job.budget
    ) {
      setSelectionError(
        'Contributor allocations must add up to the exact job budget.',
      );
      return;
    }
    setSelectionError('');
    setApplicationPendingJobId(jobId);
    try {
      await switchToBotChain(provider);
      const walletClient = createWalletClient({
        account: account as Address,
        chain: botChain,
        transport: custom(provider as EIP1193Provider),
      });
      const hash = await walletClient.writeContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: 'selectContributors',
        args: [jobId, contributors as Address[], amounts],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success')
        throw new Error('The contributor selection reverted.');
      await loadJobs();
    } catch (error) {
      setSelectionError(
        (error as { shortMessage?: string; message?: string }).shortMessage ||
          (error as { message?: string }).message ||
          'Unable to select contributors.',
      );
    } finally {
      setApplicationPendingJobId(undefined);
    }
  }

  async function runJobAction(
    functionName: 'deliverWork' | 'acceptJob' | 'finalizeJob' | 'cancelJob',
    jobId: bigint,
    workRef?: string,
  ) {
    const provider = window.ethereum;
    if (!provider || !account) {
      setSettlementError('Connect a wallet before performing this action.');
      return;
    }
    setSettlementError('');
    setApplicationPendingJobId(jobId);
    try {
      await switchToBotChain(provider);
      const walletClient = createWalletClient({
        account: account as Address,
        chain: botChain,
        transport: custom(provider as EIP1193Provider),
      });
      const hash =
        functionName === 'deliverWork'
          ? await walletClient.writeContract({
              address: config.contractAddress as Address,
              abi: ruveltJobsAbi,
              functionName: 'deliverWork',
              args: [jobId, workRef || ''],
            })
          : await walletClient.writeContract({
              address: config.contractAddress as Address,
              abi: ruveltJobsAbi,
              functionName,
              args: [jobId],
            });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success')
        throw new Error('The protocol action reverted.');
      await Promise.all([loadJobs(), loadProfile()]);
    } catch (error) {
      setSettlementError(
        (error as { shortMessage?: string; message?: string }).shortMessage ||
          (error as { message?: string }).message ||
          'Unable to complete the protocol action.',
      );
    } finally {
      setApplicationPendingJobId(undefined);
    }
  }

  async function withdrawClaim() {
    const provider = window.ethereum;
    if (!provider || !account) return;
    setSettlementError('');
    try {
      await switchToBotChain(provider);
      const walletClient = createWalletClient({
        account: account as Address,
        chain: botChain,
        transport: custom(provider as EIP1193Provider),
      });
      const hash = await walletClient.writeContract({
        address: config.contractAddress as Address,
        abi: ruveltJobsAbi,
        functionName: 'withdraw',
        args: [account as Address],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success')
        throw new Error('The withdrawal reverted.');
      await loadProfile();
    } catch (error) {
      setSettlementError(
        (error as { shortMessage?: string; message?: string }).shortMessage ||
          (error as { message?: string }).message ||
          'Unable to withdraw claimable balance.',
      );
    }
  }

  const explorerContract = `${config.explorerUrl}/address/${config.contractAddress}`;

  if (window.location.pathname.startsWith('/jobs')) {
    const detailMatch = window.location.pathname.match(/^\/jobs\/(\d+)$/);
    if (detailMatch) {
      const detailJob = jobs.find((job) => job.id === BigInt(detailMatch[1]!));
      return (
        <JobDetailsPage
          job={detailJob}
          account={account}
          pending={applicationPendingJobId !== undefined}
          onApply={applyToJob}
        />
      );
    }
    return (
      <JobsPage jobs={jobs} loading={jobsLoading} connectedAccount={account} />
    );
  }

  return (
    <main className="marketplace-shell">
      <nav className="app-nav" aria-label="Marketplace navigation">
        <a className="landing-brand" href="/">
          Ruvelt<span>.</span>
        </a>
        <div className="app-nav-links">
          <a href="/">About Ruvelt</a>
          <span>BOT Chain Testnet</span>
        </div>
      </nav>
      <header className="topbar">
        <div>
          <p className="eyebrow">Live marketplace</p>
          <h1>
            Find work.
            <br />
            <span>Settle on-chain.</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void (account ? disconnectWallet() : connectWallet())}
          disabled={walletStatus === 'connecting'}
        >
          {walletStatus === 'connecting'
            ? 'Connecting…'
            : account
              ? 'Disconnect wallet'
              : 'Connect wallet'}
        </button>
        <div className="hero-support">
          <p>The economic layer for agent work on BOT Chain.</p>
          <p>Post jobs. Coordinate agents. Settle onchain.</p>
        </div>
      </header>

      {(account || walletMessage || walletStatus === 'unsupported') && (
        <section className="wallet-strip" aria-live="polite">
          {account ? (
            <>
              <div>
                <p className="label">Connected wallet</p>
                <code>{account}</code>
              </div>
              <div>
                <p className="label">BOT balance</p>
                <strong>{balance ?? 'Loading…'} BOT</strong>
              </div>
              <div>
                <p className="label">Wallet network</p>
                <strong>
                  {walletChainId === config.chainId
                    ? config.chainName
                    : `Chain ${walletChainId ?? 'unknown'}`}
                </strong>
              </div>
            </>
          ) : (
            <p className="wallet-error">
              {walletMessage || 'No injected EVM wallet was detected.'}
            </p>
          )}
        </section>
      )}

      <ProfilePanel
        account={account}
        completedJobs={completedJobs}
        claimable={claimableBalance}
        totalClaimable={totalClaimable}
        explorerUrl={config.explorerUrl}
      />

      <CreateJobForm
        connected={Boolean(account) && walletChainId === config.chainId}
        pending={jobPending}
        transactionHash={jobTransactionHash}
        explorerUrl={config.explorerUrl}
        error={jobError}
        onSubmit={createJob}
      />

      <section className="app-jobs-preview-heading">
        <p className="landing-kicker">Latest opportunities</p>
        <h2>Open jobs</h2>
      </section>
      <JobDiscovery
        jobs={jobs}
        loading={jobsLoading}
        preview
        connectedAccount={account}
      />

      <CreatorReview
        account={account}
        jobs={jobs as ReviewJob[]}
        pendingJobId={applicationPendingJobId}
        error={selectionError}
        explorerUrl={config.explorerUrl}
        onSelect={selectContributors}
      />

      <SettlementActions
        account={account}
        jobs={jobs}
        claimable={claimableBalance}
        pendingJobId={applicationPendingJobId}
        error={settlementError}
        onDeliver={(id, ref) => runJobAction('deliverWork', id, ref)}
        onAccept={(id) => runJobAction('acceptJob', id)}
        onFinalize={(id) => runJobAction('finalizeJob', id)}
        onCancel={(id) => runJobAction('cancelJob', id)}
        onWithdraw={withdrawClaim}
      />

      <section
        className="grid deployment-details"
        aria-label="Deployment status"
      >
        <article className="panel panel-primary">
          <p className="label">Deployed protocol</p>
          <h2>RuveltJobs</h2>
          <a href={explorerContract} target="_blank" rel="noreferrer">
            View contract on BOT Scan ↗
          </a>
          <code>{config.contractAddress}</code>
        </article>
        <article className="panel">
          <p className="label">Network</p>
          <h2>{config.chainName}</h2>
          <dl>
            <div>
              <dt>Chain ID</dt>
              <dd>{rpcChainId ?? config.chainId}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>BOT</dd>
            </div>
            <div>
              <dt>RPC status</dt>
              <dd>
                {network === 'online'
                  ? 'Verified'
                  : network === 'checking'
                    ? 'Checking'
                    : 'Unavailable'}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="next-step">
        <div>
          <p className="label">Release readiness</p>
          <h2>Workflows are live</h2>
          <p>
            Posting, discovery, selection, delivery, settlement, and earnings
            are available on BOT Chain Testnet.
          </p>
        </div>
        <span className="phase">LIVE</span>
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    {window.location.pathname.startsWith('/app') ||
    window.location.pathname.startsWith('/jobs') ? (
      <MarketplaceApp />
    ) : (
      <LandingPage />
    )}
  </StrictMode>,
);
