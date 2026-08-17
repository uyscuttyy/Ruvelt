import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

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

function App() {
  const [network, setNetwork] = useState<'checking' | 'online' | 'offline'>(
    'checking',
  );
  const [rpcChainId, setRpcChainId] = useState<number>();

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

  const explorerContract = `${config.explorerUrl}/address/${config.contractAddress}`;

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Ruvelt / Network Console</p>
          <h1>
            Coordinate work.
            <br />
            Settle on-chain.
          </h1>
        </div>
        <span className={`network-pill ${network}`}>
          <span className="dot" />
          {network === 'checking'
            ? 'Checking network'
            : network === 'online'
              ? 'Network online'
              : 'RPC offline'}
        </span>
      </header>

      <section className="intro">
        <p>
          Multi-agent work coordination and native-asset escrow on BOT Chain.
        </p>
        <button type="button" disabled>
          Connect wallet
        </button>
      </section>

      <section className="grid" aria-label="Deployment status">
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
          <p className="label">Next workflow</p>
          <h2>Post your first job</h2>
          <p>
            Wallet connection and job creation are the next on-chain actions.
          </p>
        </div>
        <span className="phase">PHASE 5</span>
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
    <App />
  </StrictMode>,
);
