"use client";
import React from "react";
import { PermissionRequiredModalProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "./BaseModal";
import { ModalHeader } from "../Common/ModalHeader";
import { PrimaryButton } from "../Common/PrimaryButton";

export function PermissionRequiredModal({
  isOpen,
  onClose,
  zIndex,
  role,
  onConfirm,
}: ModalProp<PermissionRequiredModalProps>) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <ModalHeader title="Permission Required" onClose={onClose} />
      <div className="flex flex-col w-[550px] items-center justify-center bg-background border-2 border-primary-divider p-4 rounded-b-2xl gap-4">
        <img src="/misc/permission-denied.svg" alt="Permission Required" className="w-40" />
        <div className="w-full flex flex-col gap-2">
          <span className="text-text-primary text-center text-2xl font-bold">
            You don’t have permission to do this!
          </span>
          <span className="text-text-secondary text-center text-[16px]">
            Your current role <span className="font-bold text-text-primary">{role || "Viewer"}</span> doesn’t allow
            access to this feature. If you need access, please contact your administrator.
          </span>
        </div>
        <PrimaryButton
          containerClassName="w-full"
          onClick={() => {
            onClose();
            onConfirm && onConfirm();
          }}
          text="Got it"
        />
      </div>
    </BaseModal>
  );
}

export default PermissionRequiredModal;
