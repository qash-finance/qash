"use client";
import React from "react";
import { PayrollNotSavedModalProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "../BaseModal";
import { ModalHeader } from "../../Common/ModalHeader";
import { PrimaryButton } from "../../Common/PrimaryButton";
import { SecondaryButton } from "@/components/Common/SecondaryButton";

export function PayrollNotSavedModal({ isOpen, onClose, zIndex, onConfirm }: ModalProp<PayrollNotSavedModalProps>) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <ModalHeader title="Payroll not saved" onClose={onClose} />
      <div className="flex flex-col w-[580px] items-center justify-center bg-background border-2 border-primary-divider p-4 rounded-b-2xl gap-4">
        <div className="w-full flex flex-col gap-2 my-4">
          <span className="text-text-primary text-center text-2xl font-bold">
            Are you sure you want to leave this page?
          </span>
          <span className="text-text-secondary text-center text-[16px]">
            Your payroll hasn’t been saved yet. If you leave now, all changes will be lost.
          </span>
        </div>
        <div className="w-full flex flex-row gap-2 justify-center items-center">
          <SecondaryButton
            buttonClassName="flex-1"
            onClick={() => {
              onClose();
            }}
            text="Keep editing"
            variant="light"
          />
          <SecondaryButton
            buttonClassName="flex-1"
            onClick={() => {
              onClose();
              onConfirm && onConfirm();
            }}
            text="Leave"
            variant="red"
          />
        </div>
      </div>
    </BaseModal>
  );
}

export default PayrollNotSavedModal;
