"use client";
import React from "react";
import { ReviewPlanModalProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "./BaseModal";
import { PrimaryButton } from "../Common/PrimaryButton";

export function ReviewPlanModal({ isOpen, onClose, zIndex }: ModalProp<ReviewPlanModalProps>) {
  const features = [
    "Unlimited access to all features",
    "Unlimited access to all features",
    "Unlimited access to all features",
    "Unlimited access to all features",
    "Unlimited access to all features",
    "Unlimited access to all features",
  ];

  return (
    <BaseModal isOpen={true} onClose={onClose} zIndex={zIndex}>
      <div className="bg-background border border-primary-divider rounded-3xl w-[780px] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 p-8 border-b border-primary-divider">
          <div
            className="w-[28px] h-[28px] bg-app-background rounded-lg flex justify-center items-center border-b-2 border-secondary-divider cursor-pointer absolute top-5 right-5"
            onClick={onClose}
          >
            <img src="/misc/close-icon.svg" alt="close icon" />
          </div>

          <h2 className="text-4xl font-semibold text-text-primary">Review Your Plan</h2>
          <p className="text-sm text-text-secondary text-center mt-1">
            Please review the details below before proceeding with payment.
          </p>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Section - Features */}
          <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary mb-6">What's included</h3>
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-4">
                  {/* <CheckCircle2 className="w-5 h-5 text-teal-500 flex-shrink-0" /> */}
                  <span className="text-base font-medium text-text-primary">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Section - Plan Details */}
          <div className="w-80 bg-background border-l border-primary-divider p-6 flex flex-col justify-between overflow-y-auto">
            {/* Plan Info */}
            <div className="space-y-4 pb-6 border-b border-primary-divider">
              <div>
                <p className="text-xs font-medium text-text-secondary mb-2">Subscribe to</p>
                <div className="flex items-center gap-1 mb-4">
                  <img src="/misc/blue-lightning-icon.svg" alt="check-icon" className="w-5 h-5" />
                  <h3 className="text-xl font-semibold text-text-primary">Business</h3>
                </div>
              </div>

              {/* Plan Name & Price */}
              <div className="flex justify-between items-start pb-3 border-b border-primary-divider">
                <div>
                  <p className="text-base font-medium text-text-primary">Business Plan</p>
                  <p className="text-xs text-text-secondary">Billed monthly</p>
                </div>
                <p className="text-base font-semibold text-text-primary">$100</p>
              </div>

              {/* Subtotal */}
              <div className="flex justify-between items-center">
                <p className="text-base font-medium text-text-primary">Subtotal</p>
                <p className="text-base font-semibold text-text-primary">$100</p>
              </div>
            </div>

            {/* Total Due */}
            <div className="space-y-4 pt-6">
              <p className="text-sm text-text-secondary">Total due today</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-text-primary">$100</span>
                  <span className="text-lg text-text-secondary">/month</span>
                </div>
                <div className="bg-[#71FF92] text-[#007B4B] text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                  Save up to 30%
                </div>
              </div>

              {/* Confirm Button */}
              <PrimaryButton text="Confirm & Pay" onClick={() => {}} buttonClassName="w-full" />
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export default ReviewPlanModal;
