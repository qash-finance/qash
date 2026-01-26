"use client";

import React, { useState } from "react";
import { OnboardingModalProps, ChooseAccountModalProps } from "@/types/modal";
import { ModalProp, useModal } from "@/contexts/ModalManagerProvider";
import { MIDEN_EXPLORER_URL, QASH_TOKEN_ADDRESS } from "@/services/utils/constant";
import { PrimaryButton } from "../Common/PrimaryButton";
import BaseModal from "./BaseModal";
import toast from "react-hot-toast";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { MultisigAccountResponseDto } from "@qash/types/dto/multisig";
import { useMintTokens } from "@/services/api/multisig";

export function OnboardingModal({ isOpen, onClose, zIndex }: ModalProp<OnboardingModalProps>) {
  // **************** Custom Hooks *******************
  const { fetchBalances } = useMidenProvider();
  const { openModal } = useModal();
  const { mutate: mint, isPending } = useMintTokens();

  // **************** Local State *******************
  const [loading, setLoading] = useState(false);

  const handleMintToken = async (targetAddress?: string) => {
    const mintAddress = targetAddress;
    if (!mintAddress) return toast.error("Please connect your wallet to mint tokens");

    try {
      setLoading(true);
      toast.loading("Minting...");

      // Mint tokens to the target address (multisig account)
      mint(
        {
          accountId: mintAddress,
          data: {
            faucetId: QASH_TOKEN_ADDRESS,
            amount: 100 * 1e8, // 100 tokens with 8 decimals
          },
        },
        {
          onSuccess: data => {
            toast.dismiss();
            toast.success(
              <div>
                Mint successfully, view transaction on{" "}
                <a
                  href={`${MIDEN_EXPLORER_URL}/tx/${data.transactionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Miden Explorer
                </a>
              </div>,
            );

            fetchBalances();
            onClose();
          },
          onError: error => {
            toast.dismiss();
            toast.error("Failed to mint tokens, it might because the faucet was drained!");
            console.error(error);
          },
          onSettled: () => {
            setLoading(false);
          },
        },
      );
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to mint tokens!");
      console.error(error);
      setLoading(false);
    }
  };

  const handleAccountSelected = (account: MultisigAccountResponseDto) => {
    handleMintToken(account.accountId);
  };

  const handleRequestTokens = () => {
    openModal<ChooseAccountModalProps>("CHOOSE_ACCOUNT", {
      onConfirm: handleAccountSelected,
    });
  };

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <div className="flex flex-col items-center border-2 border-primary-divider bg-background w-[550px] rounded-2xl ">
        <main className="flex flex-col gap-6 items-center self-stretch p-3 pt-5 z-10 relative">
          {/* Close icon */}
          <div
            className="w-[28px] h-[28px] bg-app-background rounded-lg flex justify-center items-center border-b-2 border-secondary-divider cursor-pointer absolute top-4 right-4"
            onClick={onClose}
          >
            <img src="/misc/close-icon.svg" alt="close icon" />
          </div>
          {/* Token Icon and Info */}
          <div className="flex flex-col gap-4 items-center">
            <img src="/token/qash.svg" alt="QASH Token" className="w-16 h-16" />
            <div className="flex flex-col gap-2 items-center">
              <span className="text-5xl font-bold text-text-primary">100</span>
              <span className="text-xl text-text-primary text-center">
                Grab your free test tokens to start exploring Qash on testnet.
              </span>
              <p className="text-sm text-text-secondary">Click below to claim your free tokens</p>
            </div>
          </div>

          {/* Action Button */}
          <PrimaryButton
            text="Request free tokens"
            onClick={handleRequestTokens}
            loading={loading || isPending}
            containerClassName="w-full"
          />
        </main>
      </div>
    </BaseModal>
  );
}

export default OnboardingModal;
