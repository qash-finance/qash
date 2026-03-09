"use client";
import React from "react";
import { DeleteCompanyModalProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "../BaseModal";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { ModalHeader } from "@/components/Common/ModalHeader";

export function DeleteCompanyModal({ isOpen, onClose, zIndex, onDelete }: ModalProp<DeleteCompanyModalProps>) {
  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <div className="bg-background flex w-[450px] flex-col rounded-2xl">
        <ModalHeader title="Delete company" onClose={onClose} />
        <div className="flex flex-col rounded-b-2xl justify-center items-center py-5 px-3 gap-7 border-t border-2 border-primary-divider">
          <div className="flex flex-col gap-3 items-center">
            <span className="text-lg text-center text-text-primary px-5 font-bold">
              Are you sure you want to delete your company?
            </span>
            <div className="flex flex-col gap-2 px-5">
              <p className="text-sm text-center text-text-secondary">
                All team members will be removed from the company and lose access.
              </p>
              <p className="text-sm text-center text-text-secondary">
                Team members will lose access to all multisig accounts associated with this company.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-row gap-3">
            <SecondaryButton onClick={onClose} buttonClassName="flex-1" variant="light" text="Cancel" />
            <SecondaryButton
              onClick={async () => {
                await onDelete();
                onClose();
              }}
              buttonClassName="flex-1"
              variant="red"
              text="Delete"
            />
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export default DeleteCompanyModal;
