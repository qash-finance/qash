"use client";
import React from "react";
import { RemoveTeamMemberProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "../BaseModal";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { useGetPayrollPendingReviews } from "@/services/api/payroll";
import { ModalHeader } from "@/components/Common/ModalHeader";

export function RemoveTeamMember({ isOpen, onClose, zIndex, name, onRemove }: ModalProp<RemoveTeamMemberProps>) {
  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <div className="bg-background flex  w-[450px] flex-col rounded-2xl">
        <ModalHeader title="Remove team member" onClose={onClose} />
        <div className="flex flex-col rounded-b-2xl justify-center items-center py-5 px-3 gap-7 border-t border-2 border-primary-divider">
          <div className="flex flex-col gap-3 items-center">
            <span className="text-lg text-center text-text-primary px-5 font-bold">
              Are you sure you want to remove <span className="text-primary-blue">{name}</span> from the team?
            </span>
          </div>
          <div className="flex w-full flex-row gap-3">
            <SecondaryButton onClick={onClose} buttonClassName="flex-1" variant="light" text="Cancel" />
            <SecondaryButton
              onClick={() => {
                onRemove();
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

export default RemoveTeamMember;
