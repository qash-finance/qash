"use client";
import { NODE_ENDPOINT } from "../constant";

export async function deployAccount(isPublic: boolean) {
  const { AccountStorageMode, WebClient } = await import("@miden-sdk/miden-sdk");

  const client = await WebClient.createClient(NODE_ENDPOINT);
  const account = await client.newWallet(
    isPublic ? AccountStorageMode.public() : AccountStorageMode.private(),
    true,
    1,
  );
  return account;
}

export async function getAccountById(accountId: string) {
  if (typeof window === "undefined") throw new Error("getAccountById can only be used in the browser");

  try {
    const { AccountId, WebClient } = await import("@miden-sdk/miden-sdk");

    const client = await WebClient.createClient(NODE_ENDPOINT);

    // Try to get account from client
    let id;
    if (accountId.startsWith("0x")) {
      id = AccountId.fromHex(accountId);
    } else {
      //@ts-ignore
      id = AccountId.fromBech32(accountId);
    }

    // This may need to be adjusted based on the actual Miden SDK API
    // for retrieving an existing account by ID
    const account = await client.getAccount(id);
    return account;
  } catch (error) {
    console.error("Failed to get account by ID:", error);
    throw new Error("Failed to retrieve account");
  }
}

export const importAndGetAccount = async (
  client: import("@miden-sdk/miden-sdk").WebClient,
  account: string,
): Promise<any> => {
  const importPromise = (async () => {
    const { AccountId, Address } = await import("@miden-sdk/miden-sdk");

    // Resolve AccountId from hex or bech32 format
    let accountId;
    if (account.startsWith("0x") || account.startsWith("0X")) {
      accountId = AccountId.fromHex(account);
    } else if (/^[0-9a-fA-F]+$/.test(account)) {
      accountId = AccountId.fromHex(`0x${account}`);
    } else {
      // bech32 format (e.g. mtst1..._...) — Address.fromBech32 handles full address with routing info
      accountId = Address.fromBech32(account).accountId();
    }

    let accountContract = await client.getAccount(accountId);

    if (!accountContract) {
      try {
        await client.importAccountById(accountId);
        accountContract = await client.getAccount(accountId);
        if (!accountContract) {
          throw new Error(`Account not found after import: ${accountId}`);
        }
      } catch (error) {
        throw error;
      }
    }
    return accountContract;
  })();

  return importPromise;
};

export const getAccounts = async () => {
  const { WebClient, AccountInterface, NetworkId } = await import("@miden-sdk/miden-sdk");

  const client = await WebClient.createClient(NODE_ENDPOINT);

  const accounts = await client.getAccounts();

  // for each account, we use getAccount, if fail, means we dont own the account
  const accountsWeOwn = await Promise.all(
    accounts.filter(async account => {
      try {
        const readAccount = await client.getAccount(account.id());
        if (!readAccount) {
          return false;
        }
        return true;
      } catch (error) {
        return false;
      }
    }),
  );

  return accountsWeOwn.map(account => account.id().toBech32(NetworkId.testnet(), AccountInterface.BasicWallet));
};

export const exportAccounts = async () => {
  try {
    const { WebClient } = await import("@miden-sdk/miden-sdk");

    const client = await WebClient.createClient(NODE_ENDPOINT);

    const store = await client.exportStore();
    return store;
  } catch (error) {
    console.error("Failed to export account:", error);
    throw new Error("Failed to export account");
  }
};

export const importAccount = async (store: string) => {
  const { WebClient } = await import("@miden-sdk/miden-sdk");

  const client = await WebClient.createClient(NODE_ENDPOINT);
  await client.forceImportStore(store);
};
