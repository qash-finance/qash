import React from "react";
import { Tooltip } from "react-tooltip";
import { MemberActionTooltip } from "@/components/Common/ToolTip/MemberActionTooltip";
import { TeamMemberRoleEnum, TeamMemberStatusEnum } from "@qash/types/enums";
interface Member {
  id: string;
  name: string;
  email: string;
  companyRole: string;
  role: TeamMemberRoleEnum[];
  status: TeamMemberStatusEnum;
  profilePicture?: string;
}

interface MemberCardProps {
  member: Member;
  onMenuClick?: (memberId: string) => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

const Chip = ({ label }: { label: TeamMemberRoleEnum }) => (
  <div className="px-3 py-1 rounded-full w-fit flex items-center gap-1 border-b border-primary-divider bg-background">
    {label.toUpperCase() === TeamMemberRoleEnum.OWNER && (
      <img src="/misc/purple-crown-icon.svg" alt="Owner" className="w-5" />
    )}
    {label.toUpperCase() === TeamMemberRoleEnum.ADMIN && (
      <img src="/misc/green-shield-icon.svg" alt="Admin" className="w-5" />
    )}
    {label.toUpperCase() === TeamMemberRoleEnum.REVIEWER && (
      <img src="/misc/blue-note-icon.svg" alt="Reviewer" className="w-5" />
    )}
    {label.toUpperCase() === TeamMemberRoleEnum.VIEWER && (
      <img src="/misc/orange-eye-icon.svg" alt="Reviewer" className="w-5" />
    )}
    <span className="text-sm font-medium">{label}</span>
  </div>
);

const MemberCard: React.FC<MemberCardProps> = ({ member, onMenuClick, onEdit, onRemove }) => {
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMenuClick) onMenuClick(member.id);
  };

  const tooltipId = `member-action-tooltip-${member.id}`;

  return (
    <div className="border border-primary-divider rounded-[16px] p-4 flex flex-col gap-4 bg-app-background">
      {/* Card Header */}
      <div className="flex items-start justify-between">
        {/* Account Info */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Avatar */}
          {member.profilePicture ? (
            <img src={member.profilePicture} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary-blue to-blue-600 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-white">
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Account Details */}
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-medium leading-none">{member.name}</h3>
            <p className="text-sm font-normal text-text-secondary leading-none">{member.email}</p>
          </div>

          {/* Company Role */}
          <span className="text-primary-blue font-bold">{member.companyRole}</span>

          {/* Roles */}
          <div className="flex gap-2 items-center">
            {member.role.map((role, index) => (
              <Chip key={index} label={role} />
            ))}
            {member.status === TeamMemberStatusEnum.PENDING && (
              <span className="text-sm italic text-text-secondary">Pending Invite</span>
            )}
          </div>
        </div>

        {/* Menu Button */}
        {(onEdit || onRemove) && (
          <img
            src="/misc/vertical-three-dot-icon.svg"
            alt="Menu"
            className="w-6 cursor-pointer"
            onClick={handleMenuClick}
            data-tooltip-id={tooltipId}
            data-tooltip-content={member.id}
          />
        )}
      </div>

      {/* Per-card tooltip (if handlers provided) */}
      {(onEdit || onRemove) && (
        <Tooltip
          id={tooltipId}
          clickable
          style={{ zIndex: 20, borderRadius: "16px", padding: "0" }}
          place="left"
          openOnClick
          noArrow
          border="none"
          opacity={1}
          render={() => {
            return <MemberActionTooltip onEdit={onEdit} onRemove={onRemove} />;
          }}
        />
      )}
    </div>
  );
};

export default MemberCard;
