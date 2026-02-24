"use client";
import { TeamMemberRoleEnum } from "@qash/types/enums";
import type { TeamMemberRoleEnum as TeamMemberRoleType } from "@qash/types/enums";
import React, { useState, useRef, useEffect, useMemo } from "react";

interface TeamMemberRoleDropdownProps {
  selectedRole?: TeamMemberRoleType;
  onRoleSelect: (role: TeamMemberRoleType) => void;
  disabled?: boolean;
  variant?: "outlined" | "filled";
  size?: "default" | "compact";
}

const getRoleIcon = (role: TeamMemberRoleEnum) => {
  switch (role) {
    case "ADMIN":
      return "/misc/green-shield-icon.svg";
    case "VIEWER":
      return "/misc/orange-eye-icon.svg";
    case "REVIEWER":
      return "/misc/blue-note-icon.svg";
    case "OWNER":
      return "/misc/purple-crown-icon.svg";
  }
};

export const TeamMemberRoleDropdown = ({
  selectedRole,
  onRoleSelect,
  disabled = false,
  variant = "outlined",
  size = "default",
}: TeamMemberRoleDropdownProps) => {
  const containerStyle = useMemo(() => {
    const baseStyle =
      variant === "outlined"
        ? "border border-primary-divider rounded-xl bg-transparent"
        : "bg-app-background border-b-2 border-primary-divider rounded-xl";
    const heightStyle = size === "compact" ? "h-[52px]" : "h-[64px]";
    return `${baseStyle} ${heightStyle}`;
  }, [variant, size]);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleRoleClick = (role: TeamMemberRoleType) => {
    onRoleSelect(role);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 w-full text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed justify-between ${containerStyle}`}
        disabled={disabled}
      >
        <div className="flex flex-col justify-center">
          <span className={`text-text-secondary ${size === "compact" ? "text-[12px]" : "text-[14px]"}`}>Access as</span>
          {selectedRole && (
            <div className="flex items-center gap-1">
              <img
                src={getRoleIcon(selectedRole)}
                alt={selectedRole}
                className={`${size === "compact" ? "w-5 h-5" : "w-6 h-6"} flex-shrink-0`}
              />
              <p className={`text-text-primary capitalize  ${size === "compact" ? "text-[14px]" : "text-[16px]"}`}>
                {selectedRole.toLowerCase()}
              </p>
            </div>
          )}
        </div>

        <img
          src="/arrow/chevron-down.svg"
          alt="dropdown"
          className={`w-6 h-6 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mb-5 shadow-lg bg-background border-2 border-primary-divider rounded-xl z-50 overflow-hidden p-2  overflow-y-auto">
          <div className="px-2 py-1">
            <p className="text-text-secondary text-xs">Select a role</p>
          </div>

          <div className="flex flex-col">
            {Object.values(TeamMemberRoleEnum)
              .filter(role => role !== TeamMemberRoleEnum.OWNER)
              .map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleClick(role as TeamMemberRoleType)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-app-background transition-colors cursor-pointer ${
                    selectedRole === role ? "bg-app-background" : ""
                  }`}
                >
                  <img src={getRoleIcon(role)} alt={`${role} icon`} className="w-6 h-6" />
                  <span className="text-text-primary capitalize">{role.toLowerCase()}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
