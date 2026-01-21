"use client";
import { TeamMemberRoleEnum } from "@qash/types/enums";
import React from "react";

interface MemberRoleTooltipProps {
  currentRole: TeamMemberRoleEnum;
  onRoleChange: (role: TeamMemberRoleEnum) => void;
}

const RoleItem = ({
  role,
  isActive,
  onClick,
  isFirst = false,
  isLast = false,
}: {
  role: TeamMemberRoleEnum;
  isActive: boolean;
  onClick: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  const getRoleIcon = () => {
    switch (role) {
      case TeamMemberRoleEnum.ADMIN:
        return "/misc/green-shield-icon.svg";
      case TeamMemberRoleEnum.VIEWER:
        return "/misc/orange-eye-icon.svg";
      case TeamMemberRoleEnum.REVIEWER:
        return "/misc/blue-note-icon.svg";
      case TeamMemberRoleEnum.OWNER:
        return "/misc/purple-crown-icon.svg";
    }
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-3 w-full cursor-pointer 
        transition-colors duration-200
        ${isFirst ? "rounded-t-2xl" : ""}
        ${isLast ? "rounded-b-2xl" : ""}
        ${isActive ? "bg-app-background" : "hover:bg-app-background/50"}
      `}
      onClick={onClick}
    >
      <img src={getRoleIcon()} alt={role} className="w-5 h-5" />
      <span className={`text-sm font-medium ${isActive ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
        {role.toLowerCase().charAt(0).toUpperCase() + role.slice(1).toLowerCase()}
      </span>
    </div>
  );
};

export const MemberRoleTooltip = ({ currentRole, onRoleChange }: MemberRoleTooltipProps) => {
  return (
    <div className="bg-background border border-primary-divider rounded-2xl shadow-lg w-[160px]">
      {/* Admin Role */}
      <RoleItem
        role={TeamMemberRoleEnum.ADMIN}
        isActive={currentRole === TeamMemberRoleEnum.ADMIN}
        onClick={() => onRoleChange(TeamMemberRoleEnum.ADMIN)}
        isFirst
      />

      {/* Divider */}
      <div className="border-t w-full border-primary-divider" />

      {/* Reviewer Role */}
      <RoleItem
        role={TeamMemberRoleEnum.REVIEWER}
        isActive={currentRole === TeamMemberRoleEnum.REVIEWER}
        onClick={() => onRoleChange(TeamMemberRoleEnum.REVIEWER)}
      />

      {/* Divider */}
      <div className="border-t w-full border-primary-divider" />

      {/* Viewer Role */}
      <RoleItem
        role={TeamMemberRoleEnum.VIEWER}
        isActive={currentRole === TeamMemberRoleEnum.VIEWER}
        onClick={() => onRoleChange(TeamMemberRoleEnum.VIEWER)}
        isLast
      />
    </div>
  );
};
