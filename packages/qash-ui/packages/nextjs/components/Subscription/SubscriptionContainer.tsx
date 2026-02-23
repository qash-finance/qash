"use client";
import React, { useState } from "react";
import { PageHeader } from "../Common/PageHeader";
import { TabContainer } from "../Common/TabContainer";
import { SecondaryButton } from "../Common/SecondaryButton";

const tabs = [
  { id: "monthly", label: "Pay Monthly" },
  { id: "yearly", label: "Pay Yearly" },
];

const SubscriptionContainer = () => {
  // **************** Local State *******************
  const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="flex flex-col w-full h-full bg-background gap-2 items-center justify-start p-4">
      <PageHeader icon="/misc/blue-lightning-icon.svg" label="Pricing" button={null} />

      <div className="justify-center text-5xl font-bold">Choose your plan</div>

      {/* Tab Navigation */}
      <div className="w-[300px] my-4">
        <TabContainer
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={(tab: string) => setActiveTab(tab as "monthly" | "yearly")}
        />
      </div>

      <div className="w-full h-full flex flex-row gap-5 justify-center">
        {/* Basic */}
        <div className="flex flex-row">
          <div
            className="flex flex-col rounded-4xl h-[540px] w-[330px] px-[6px] pb-2"
            style={{
              background: "linear-gradient(180deg, #D7D7D7 -2.55%, #F4F4F4 28.78%, #F6F6F6 68.36%)",
            }}
          >
            <span className="text-[20px] ml-3 my-4">Basic</span>

            <div
              className="flex flex-col rounded-3xl h-full w-full bg-background p-4"
              style={{
                boxShadow: "0 0 8.4px 0 rgba(0, 0, 0, 0.15)",
              }}
            >
              <span className="text-text-secondary leading-5">
                Ideal for hobbyists and individuals exploring web app creation.
              </span>

              <div className="flex flex-row w-full items-center gap-1 mt-2">
                <span className="text-2xl">$</span>
                <span className="text-4xl">0</span>
                <span className="text-text-secondary text-xl">/month</span>
              </div>

              <SecondaryButton text="Get started for free" buttonClassName="my-4" onClick={() => {}} />

              <div className="flex flex-col rounded-2xl h-full w-full p-4 border border-primary-divider">
                <div className="flex flex-row w-full items-center">
                  <img src="/misc/check-icon.svg" alt="check-icon" className="w-5 h-5 mr-2" />
                  <span>Unlimited access to all features</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Growth */}
        <div className="flex flex-row">
          <div
            className="flex flex-col rounded-4xl h-[540px] w-[330px] px-[6px] pb-2"
            style={{
              background: "linear-gradient(180deg, #0061E7 -2.55%, #A7CCFF 28.78%, #F6F6F6 68.36%)",
            }}
          >
            <span className="text-[20px] ml-3 my-4 text-white">Growth</span>

            <div
              className="flex flex-col rounded-3xl h-full w-full bg-background p-4"
              style={{
                boxShadow: "0 0 8.4px 0 rgba(0, 0, 0, 0.15)",
              }}
            >
              <span className="text-text-secondary leading-5">
                Designed for creators and startups scaling their digital products.
              </span>

              <div className="flex flex-row w-full items-center gap-1 mt-2">
                <span className="text-2xl">$</span>
                <span className="text-4xl">20</span>
                <span className="text-text-secondary text-xl">/month</span>
              </div>

              <SecondaryButton text="Current plan" buttonClassName="my-4" variant="light" onClick={() => {}} />

              <div className="flex flex-col rounded-2xl h-full w-full p-4 border border-primary-divider">
                <div className="flex flex-row w-full items-center">
                  <img src="/misc/check-icon.svg" alt="check-icon" className="w-5 h-5 mr-2" />
                  <span>Unlimited access to all features</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Business */}
        <div className="flex flex-row">
          <div
            className="flex flex-col rounded-4xl h-[540px] w-[330px] px-[6px] pb-2"
            style={{
              background: "linear-gradient(180deg, #00D563 -2.55%, #00C0D5 28.78%, #F6F6F6 68.36%)",
            }}
          >
            <span className="text-[20px] ml-3 my-4 text-white">Business</span>

            <div
              className="flex flex-col rounded-3xl h-full w-full bg-background p-4"
              style={{
                boxShadow: "0 0 8.4px 0 rgba(0, 0, 0, 0.15)",
              }}
            >
              <span className="text-text-secondary leading-5">
                Designed for creators and startups scaling their digital products.
              </span>

              <div className="flex flex-row w-full items-center gap-1 mt-2">
                <span className="text-2xl">$</span>
                <span className="text-4xl">100</span>
                <span className="text-text-secondary text-xl">/month</span>
              </div>

              <SecondaryButton text="Current plan" buttonClassName="my-4" onClick={() => {}} />

              <div className="flex flex-col rounded-2xl h-full w-full p-4 border border-primary-divider">
                <div className="flex flex-row w-full items-center">
                  <img src="/misc/check-icon.svg" alt="check-icon" className="w-5 h-5 mr-2" />
                  <span>Unlimited access to all features</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionContainer;
