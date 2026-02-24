"use client";
import { useParams } from "next/navigation";
import React, { useState } from "react";
import { useGetPaymentLinkByCode, useRecordPayment } from "@/services/api/payment-link";
import { formatAddress } from "@/services/utils/miden/address";
import toast from "react-hot-toast";
import { PaymentLinkStatus } from "@qash/types/dto/payment-link";
import { MODAL_IDS } from "@/types/modal";
import { useModal } from "@/contexts/ModalManagerProvider";
import { importAndGetAccount } from "@/services/utils/miden/account";
import { PaymentLinkPreview } from "@/components/PaymentLink/PaymentLinkPreview";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { useWallet, SendTransaction } from "@miden-sdk/miden-wallet-adapter";
import { QASH_TOKEN_ADDRESS, QASH_TOKEN_DECIMALS } from "@/services/utils/constant";

const Header = () => {
  const { address: paraAddress, openModal: openParaModal, logoutAsync } = useMidenProvider();
  const { address: adapterAddress, disconnect: adapterDisconnect } = useWallet();
  const { openModal } = useModal();
  const walletAddress = paraAddress || adapterAddress;

  const handleWalletClick = () => {
    if (paraAddress) {
      // Para connected — open Para account modal (shows balances)
      openParaModal?.();
    } else if (adapterAddress) {
      // Miden wallet adapter connected — open portfolio modal
      openModal(MODAL_IDS.PORTFOLIO);
    }
  };

  const handleDisconnect = async () => {
    if (paraAddress) {
      await logoutAsync();
    } else if (adapterAddress && adapterDisconnect) {
      await adapterDisconnect();
    }
  };

  return (
    <div className="w-full flex justify-between items-center p-2 pt-1">
      <div className="flex items-center justify-center">
        <img src="/logo/qash-icon.svg" alt="Qash Logo" />
        <img
          src="/logo/ash-text-icon.svg"
          alt="Qash Logo"
          className="w-12"
          style={{ transition: "width 200ms ease" }}
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        {walletAddress && (
          <>
            <div
              className="flex items-center justify-center gap-2 bg-background rounded-lg p-2 py-1.5 border-t-2 border-primary-divider cursor-pointer"
              onClick={handleWalletClick}
            >
              <img src="/chain/miden.svg" alt="Miden" />
              <span className="text-text-primary text-lg">{formatAddress(walletAddress)}</span>
            </div>
            <div
              className="flex items-center justify-center bg-background rounded-lg p-2 py-1.5 border-t-2 border-primary-divider cursor-pointer hover:bg-app-background transition-colors"
              onClick={handleDisconnect}
              title="Disconnect wallet"
            >
              <img src="/misc/close-icon.svg" alt="disconnect" className="w-4 h-4" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const PaymentSuccess = ({
  amount,
  tokenSymbol,
  recipientName,
}: {
  amount: string;
  tokenSymbol: string;
  recipientName: string;
}) => {
  return (
    <div className="flex flex-col w-full h-full justify-center items-center gap-4">
      <img src="/modal/green-circle-check.gif" alt="Payment Success" className="w-20" />
      <h2 className="text-4xl font-semibold text-text-primary">Payment successful</h2>
      <p className="text-base text-text-secondary text-center max-w-[400px]">
        You have successfully sent {amount} {tokenSymbol} to {recipientName}.
      </p>
    </div>
  );
};

const PaymentLinkDetailPage = () => {
  const params = useParams();
  const code = params.code as string;
  const { address: paraAddress, client: midenClient } = useMidenProvider();
  const { address: adapterAddress, connected: adapterConnected, requestSend, wallet } = useWallet();
  const walletAddress = paraAddress || adapterAddress;
  const { data: paymentLink, isLoading, error } = useGetPaymentLinkByCode(code);
  const recordPaymentMutation = useRecordPayment();
  const { openModal, closeModal } = useModal();
  const [isSending, setIsSending] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    amount: string;
    tokenSymbol: string;
    recipientName: string;
  } | null>(null);

  const handleSubmitPayment = async () => {
    if (!walletAddress) {
      return toast.error("Please connect your wallet");
    }

    const paymentTokenAddress = paymentLink?.acceptedTokens?.[0]?.address;
    const paymentAmount = parseFloat(paymentLink?.amount || "0");
    // Use on-chain decimals constant for QASH token (existing payment links may have stale decimals stored)
    const tokenDecimals =
      paymentTokenAddress === QASH_TOKEN_ADDRESS
        ? QASH_TOKEN_DECIMALS
        : paymentLink?.acceptedTokens?.[0]?.decimals || 6;
    const recipientAddress = paymentLink?.paymentWalletAddress;

    if (!paymentTokenAddress || !recipientAddress) {
      toast.error("Invalid payment details");
      return;
    }

    try {
      setIsSending(true);
      openModal("PROCESSING_TRANSACTION");

      let txHash: string;

      if (adapterConnected && adapterAddress && requestSend) {
        // Miden Wallet Adapter flow — amount must be in smallest unit (raw)
        const rawAmount = paymentAmount * 10 ** tokenDecimals;
        const sendTx = new SendTransaction(adapterAddress, recipientAddress, paymentTokenAddress, "private", rawAmount);
        txHash = await requestSend(sendTx);
        console.log("txHash", txHash);
      } else if (paraAddress && midenClient) {
        // Para (social login) flow — build and submit transaction via WebClient
        txHash = await handleParaPayment(paraAddress, recipientAddress, paymentTokenAddress, paymentAmount);
      } else {
        toast.error("No wallet connected");
        closeModal("PROCESSING_TRANSACTION");
        return;
      }

      recordPaymentMutation.mutate({
        code,
        data: {
          payer: walletAddress,
          txid: txHash,
          token: paymentLink?.acceptedTokens?.[0],
        },
      });
      closeModal("PROCESSING_TRANSACTION");
      setPaymentSuccess({
        amount: paymentAmount.toString(),
        tokenSymbol: paymentLink?.acceptedTokens?.[0]?.symbol || "",
        recipientName: paymentLink?.title || "Receiver",
      });
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to process the transaction");
    } finally {
      setIsSending(false);
      closeModal("PROCESSING_TRANSACTION");
    }
  };

  const handleParaPayment = async (
    senderAddress: string,
    recipientAddress: string,
    paymentTokenAddress: string,
    paymentAmount: number,
  ): Promise<string> => {
    const midenSdk = await import("@miden-sdk/miden-sdk");
    const {
      Note,
      Address,
      NoteAssets,
      FungibleAsset,
      NoteType,
      NoteAttachment,
      TransactionRequestBuilder,
      BasicFungibleFaucetComponent,
      OutputNote,
    } = midenSdk;
    const OutputNoteArray = (midenSdk as any).OutputNoteArray;

    const faucetAccount = await importAndGetAccount(midenClient, paymentTokenAddress);
    const faucetMetadata = await BasicFungibleFaucetComponent.fromAccount(faucetAccount);

    const p2idNote = Note.createP2IDNote(
      Address.fromBech32(senderAddress).accountId(),
      Address.fromBech32(recipientAddress).accountId(),
      new NoteAssets([
        new FungibleAsset(
          Address.fromBech32(paymentTokenAddress).accountId(),
          BigInt(paymentAmount * 10 ** (faucetMetadata.decimals() || 6)),
        ),
      ]),
      NoteType.Private,
      new NoteAttachment(),
    );
    const p2idNoteCopy = p2idNote;

    const outputNotesArray = new OutputNoteArray([OutputNote.full(p2idNote)]);
    const transactionRequest = new TransactionRequestBuilder().withOwnOutputNotes(outputNotesArray).build();
    const midenParaClient = midenClient as import("@miden-sdk/miden-sdk").WebClient;
    const executedTx = await midenParaClient.executeTransaction(
      Address.fromBech32(senderAddress).accountId(),
      transactionRequest,
    );
    const provenTx = await midenParaClient.proveTransaction(executedTx);
    const submissionHeight = await midenParaClient.submitProvenTransaction(provenTx, executedTx);
    await midenParaClient.applyTransaction(executedTx, submissionHeight);
    await midenParaClient.sendPrivateNote(p2idNoteCopy, Address.fromBech32(recipientAddress));

    return executedTx.executedTransaction().id().toHex();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <img src="/loading-square.gif" alt="loading" className="w-12 h-12" />
      </div>
    );
  }

  if (error || !paymentLink || paymentLink.status === PaymentLinkStatus.DEACTIVATED) {
    return (
      <div className="flex flex-col w-full h-full bg-app-background p-2 gap-2">
        <Header />

        <div
          className="w-full h-full relative flex justify-center items-center flex-col rounded-lg"
          style={{
            background: "linear-gradient(180deg, #D7D7D7 0%, #FFF 60.33%)",
          }}
        >
          <div className="w-fit h-fit relative flex justify-center items-center flex-col gap-4 z-2">
            <span className="text-text-primary text-7xl font-bold anton-regular leading-none uppercase">
              Oops, this link isn’t active anymore.
            </span>
            <span className="text-text-primary text-lg">
              Looks like the creator has turned it off. You can reach out to them to get a new one.
            </span>
          </div>
        </div>

        <img
          src="/gift/background-qash-text.svg"
          alt="background-qash-text"
          className="w-[1050px] absolute top-100 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-app-background p-2">
      <Header />

      <div className="flex flex-col w-full h-screen p-4 items-center justify-start gap-10 bg-background rounded-lg">
        {paymentSuccess ? (
          <PaymentSuccess {...paymentSuccess} />
        ) : (
          <>
            {/* Header */}
            <div className="w-full flex flex-row gap-2 px-7 items-center justify-start">
              <img src="/misc/star-icon.svg" alt="Payment Link" />
              <h1 className="text-2xl font-bold">Payment Link</h1>
            </div>

            <div className="flex flex-col gap-5 py-5 w-[80%]">
              <PaymentLinkPreview
                recipient={paymentLink.company.companyName}
                recipientAvatar={
                  paymentLink.company.companyLogo ? paymentLink.company.companyLogo : "/logo/qash-icon-dark.svg"
                }
                paymentWalletAddress={paymentLink.paymentWalletAddress}
                amount={paymentLink.amount}
                title={paymentLink.title}
                description={paymentLink.description}
                selectedToken={
                  paymentLink.acceptedTokens?.[0]
                    ? {
                        faucetId: paymentLink.acceptedTokens?.[0]?.address || "",
                        metadata: {
                          symbol: paymentLink.acceptedTokens?.[0]?.symbol || "",
                          decimals: paymentLink.acceptedTokens?.[0]?.decimals || 6,
                          maxSupply: 0,
                        },
                        amount: "0",
                      }
                    : null
                }
                handleConnectWallet={() => openModal(MODAL_IDS.SELECT_WALLET)}
                handleSubmitPayment={handleSubmitPayment}
                isSending={isSending}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentLinkDetailPage;
