import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPublicConfig } from '../src/index.ts';

const validEnvironment = {
  VITE_BOT_CHAIN_ID: '12345',
  VITE_BOT_CHAIN_NAME: 'BOT Chain Testnet',
  VITE_BOT_RPC_URL: 'https://rpc.example.com',
  VITE_BOT_BLOCK_EXPLORER_URL: 'https://explorer.example.com',
};

test('loads and normalizes valid public configuration', () => {
  const config = loadPublicConfig(validEnvironment);
  assert.equal(config.chainId, 12345);
  assert.equal(config.rpcUrl.origin, 'https://rpc.example.com');
  assert.equal(config.contractAddress, undefined);
});

test('fails when a required value is absent', () => {
  assert.throws(
    () => loadPublicConfig({ ...validEnvironment, VITE_BOT_RPC_URL: '' }),
    /Missing required environment variable: VITE_BOT_RPC_URL/,
  );
});

test('rejects unsafe chain IDs and malformed addresses', () => {
  assert.throws(
    () => loadPublicConfig({ ...validEnvironment, VITE_BOT_CHAIN_ID: '-1' }),
    /positive integer/,
  );
  assert.throws(
    () =>
      loadPublicConfig({
        ...validEnvironment,
        VITE_RUVELT_CONTRACT_ADDRESS: '0x1234',
      }),
    /20-byte hex address/,
  );
});
