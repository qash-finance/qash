import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Service to communicate with the Rust Miden multisig server
 * This is a stateless Miden client wrapper
 */
@Injectable()
export class MidenClientService {
  private readonly logger = new Logger(MidenClientService.name);
  private readonly client: AxiosInstance;
  private readonly midenServerUrl: string;

  constructor(private configService: ConfigService) {
    this.midenServerUrl =
      this.configService.get<string>('MIDEN_SERVER_URL') ||
      'http://localhost:3005';

    this.client = axios.create({
      baseURL: this.midenServerUrl,
      timeout: 60000, // 60 seconds for blockchain operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Miden client initialized: ${this.midenServerUrl}`);
  }

  /**
   * Create a multisig account via Miden client
   */
  async createMultisigAccount(
    publicKeys: string[],
    threshold: number,
  ): Promise<{ accountId: string }> {
    try {
      this.logger.debug(
        `Creating multisig account with ${publicKeys.length} approvers, threshold ${threshold}`,
      );

      const response = await this.client.post('/multisig/create-account', {
        public_keys: publicKeys,
        threshold,
      });

      this.logger.log(
        `Multisig account created: ${response.data.account_id}`,
      );

      return {
        accountId: response.data.account_id,
      };
    } catch (error) {
      this.logger.error('Failed to create multisig account', error);
      throw new HttpException(
        `Failed to create multisig account: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get consumable notes for an account
   */
  async getConsumableNotes(accountId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting consumable notes for account: ${accountId}`);

      const response = await this.client.get(
        `/multisig/${accountId}/notes`,
      );

      return response.data.notes || [];
    } catch (error) {
      this.logger.error('Failed to get consumable notes', error);
      throw new HttpException(
        `Failed to get consumable notes: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get account balances
   */
  async getAccountBalances(accountId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting balances for account: ${accountId}`);

      const response = await this.client.get(
        `/multisig/${accountId}/balances`,
      );

      return response.data.balances || [];
    } catch (error) {
      this.logger.error('Failed to get account balances', error);
      throw new HttpException(
        `Failed to get account balances: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get balances for multiple accounts
   */
  async getBatchAccountBalances(
    accountIds: string[],
  ): Promise<Array<{ accountId: string; balances: any[] }>> {
    try {
      this.logger.debug(
        `Getting balances for ${accountIds.length} accounts`,
      );

      const response = await this.client.post('/multisig/balances', {
        account_ids: accountIds,
      });

      return response.data.accounts || [];
    } catch (error) {
      this.logger.error('Failed to get batch account balances', error);
      throw new HttpException(
        `Failed to get batch account balances: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a consume notes proposal
   */
  async createConsumeProposal(
    accountId: string,
    noteIds: string[],
  ): Promise<{
    summaryCommitment: string;
    summaryBytesHex: string;
    requestBytesHex: string;
  }> {
    try {
      this.logger.debug(
        `Creating consume proposal for account ${accountId} with ${noteIds.length} notes`,
      );

      const response = await this.client.post('/multisig/consume-proposal', {
        account_id: accountId,
        note_ids: noteIds,
      });

      return {
        summaryCommitment: response.data.summary_commitment,
        summaryBytesHex: response.data.summary_bytes_hex,
        requestBytesHex: response.data.request_bytes_hex,
      };
    } catch (error) {
      this.logger.error('Failed to create consume proposal', error);
      throw new HttpException(
        `Failed to create consume proposal: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a send funds proposal
   */
  async createSendProposal(
    accountId: string,
    recipientId: string,
    faucetId: string,
    amount: number,
  ): Promise<{
    summaryCommitment: string;
    summaryBytesHex: string;
    requestBytesHex: string;
  }> {
    try {
      this.logger.debug(
        `Creating send proposal: ${accountId} -> ${recipientId} (${amount})`,
      );

      const response = await this.client.post('/multisig/send-proposal', {
        account_id: accountId,
        recipient_id: recipientId,
        faucet_id: faucetId,
        amount,
      });

      return {
        summaryCommitment: response.data.summary_commitment,
        summaryBytesHex: response.data.summary_bytes_hex,
        requestBytesHex: response.data.request_bytes_hex,
      };
    } catch (error) {
      this.logger.error('Failed to create send proposal', error);
      throw new HttpException(
        `Failed to create send proposal: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a batch send funds proposal with multiple recipients and faucets
   */
  async createBatchSendProposal(
    accountId: string,
    payments: Array<{ recipientId: string; faucetId: string; amount: number }>,
  ): Promise<{
    summaryCommitment: string;
    summaryBytesHex: string;
    requestBytesHex: string;
  }> {
    try {
      this.logger.debug(
        `Creating batch send proposal for account ${accountId} with ${payments.length} payments`,
      );

      const payload = {
        account_id: accountId,
        recipients: payments.map(p => ({
          recipient_id: p.recipientId,
          faucet_id: p.faucetId,
          amount: p.amount,
        })),
      };

      const response = await this.client.post('/multisig/batch-send-proposal', payload);

      this.logger.debug(
        `Batch send proposal created with commitment: ${response.data.summary_commitment}`,
      );

      return {
        summaryCommitment: response.data.summary_commitment,
        summaryBytesHex: response.data.summary_bytes_hex,
        requestBytesHex: response.data.request_bytes_hex,
      };
    } catch (error) {
      this.logger.error('Failed to create batch send proposal', error);
      // Log server response body (if any) to help debugging
      if (error.response?.data) {
        this.logger.debug('Batch send proposal server response: %o', error.response.data);
      }
      throw new HttpException(
        `Failed to create batch send proposal: ${error.response?.data?.message || JSON.stringify(error.response?.data) || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute a multisig transaction with collected signatures
   */
  async executeTransaction(
    accountId: string,
    requestBytesHex: string,
    summaryBytesHex: string,
    signaturesHex: (string | null)[],
    publicKeysHex: string[],
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      this.logger.debug(`Executing multisig transaction for ${accountId}`);

      const response = await this.client.post('/multisig/execute', {
        account_id: accountId,
        request_bytes_hex: requestBytesHex,
        summary_bytes_hex: summaryBytesHex,
        signatures_hex: signaturesHex,
        public_keys_hex: publicKeysHex,
      });

      return {
        success: response.data.success,
        transactionId: response.data.transaction_id,
        error: response.data.error,
      };
    } catch (error) {
      this.logger.error('Failed to execute multisig transaction', error);
      return {
        success: false,
        error:
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message,
      };
    }
  }

  /**
   * Health check for Miden server
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Miden server health check failed', error);
      return false;
    }
  }

  /**
   * Mint tokens to a multisig account from a faucet (direct execution)
   */
  async mintTokens(
    accountId: string,
    faucetId: string,
    amount: number,
  ): Promise<{ transactionId: string }> {
    try {
      this.logger.debug(
        `Minting ${amount} tokens to account ${accountId} from faucet ${faucetId}`,
      );

      const response = await this.client.post('/mint', {
        account_id: accountId,
        faucet_id: faucetId,
        amount,
      });

      this.logger.log(
        `Tokens minted successfully. Transaction ID: ${response.data.transaction_id}`,
      );

      return {
        transactionId: response.data.transaction_id,
      };
    } catch (error) {
      this.logger.error('Failed to mint tokens', error);
      throw new HttpException(
        `Failed to mint tokens: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Submit a zoroswap order
   * 
   * Sends order parameters to the stateless Miden server.
   * The server will:
   * 1. Build the zoroswap note from the parameters
   * 2. Send it to the Zoro AMM server for execution
   * 3. Return the P2ID note result
   */
  async submitZoroswapOrder(
    accountId: string,
    faucetIdIn: string,
    amountIn: number,
    faucetIdOut: string,
    minAmountOut: number,
    recipientAccountId: string,
    deadline: number,
  ): Promise<{ success: boolean; orderId?: string; message: string; p2idNote?: string }> {
    try {
      this.logger.debug(
        `Submitting zoroswap order: ${amountIn} from ${faucetIdIn} to ${faucetIdOut}`,
      );

      const response = await this.client.post('/orders/submit', {
        account_id: accountId,
        faucet_id_in: faucetIdIn,
        amount_in: amountIn,
        faucet_id_out: faucetIdOut,
        min_amount_out: minAmountOut,
        recipient_account_id: recipientAccountId,
        deadline,
      });

      this.logger.log(
        `Zoroswap order submitted successfully. Order ID: ${response.data.order_id}`,
      );

      return {
        success: response.data.success,
        orderId: response.data.order_id,
        message: response.data.message,
        p2idNote: response.data.p2id_note,
      };
    } catch (error) {
      this.logger.error('Failed to submit zoroswap order', error);
      throw new HttpException(
        `Failed to submit zoroswap order: ${error.response?.data?.message || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
