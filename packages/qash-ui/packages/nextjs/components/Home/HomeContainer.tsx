"use client";
import React from "react";
import { CardContainer } from "./CardContainer";
import { Overview } from "./Overview";
import { PageHeader } from "../Common/PageHeader";

export const HomeContainer = () => {
  return (
    <div className="w-full h-full p-5 flex flex-col items-start gap-4">
      <div className="w-full flex flex-col gap-4 px-5">
        <PageHeader icon="/sidebar/home.svg" label="Dashboard" button={null} />
        <CardContainer />
      </div>
      <Overview />
    </div>
  );
};
