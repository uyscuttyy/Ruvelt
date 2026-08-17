export type PublicConfig = {
  chainId: number;
  chainName: string;
  rpcUrl: URL;
  blockExplorerUrl: URL;
  contractAddress?: `0x${string}`;
};

type Environment = Record<string, string | undefined>;

function required(environment: Environment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseUrl(value: string, key: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error();
    return url;
  } catch {
    throw new Error(`${key} must be a valid HTTP(S) URL`);
  }
}

export function loadPublicConfig(environment: Environment): PublicConfig {
  const chainIdValue = required(environment, 'VITE_BOT_CHAIN_ID');
  const chainId = Number(chainIdValue);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error('VITE_BOT_CHAIN_ID must be a positive integer');
  }

  const contractAddress = environment.VITE_RUVELT_CONTRACT_ADDRESS?.trim();
  if (contractAddress && !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    throw new Error(
      'VITE_RUVELT_CONTRACT_ADDRESS must be a 20-byte hex address',
    );
  }

  return {
    chainId,
    chainName: required(environment, 'VITE_BOT_CHAIN_NAME'),
    rpcUrl: parseUrl(
      required(environment, 'VITE_BOT_RPC_URL'),
      'VITE_BOT_RPC_URL',
    ),
    blockExplorerUrl: parseUrl(
      required(environment, 'VITE_BOT_BLOCK_EXPLORER_URL'),
      'VITE_BOT_BLOCK_EXPLORER_URL',
    ),
    ...(contractAddress
      ? { contractAddress: contractAddress as `0x${string}` }
      : {}),
  };
}
