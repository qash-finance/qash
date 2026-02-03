"use client";
import React from "react";

export const PageHeader = ({ icon, label, button }: { icon: string; label: string; button: React.ReactNode }) => {
  return (
    <div className="flex flex-row items-center justify-between w-full">
      <div className="flex flex-row items-center justify-start gap-3">
        <img src={icon} alt="Qash" className="w-6 h-6" />
        <span className="text-2xl font-bold">{label}</span>
      </div>

      {button}
    </div>
  );
};
