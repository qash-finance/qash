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
}
