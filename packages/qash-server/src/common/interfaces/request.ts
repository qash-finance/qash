export interface RequestWithUser extends Request {
  user: any;
}

export interface RequestWithWalletAuth extends Request {
  walletAuth: {
    walletAddress: string;
    publicKey: string;
  };
}
