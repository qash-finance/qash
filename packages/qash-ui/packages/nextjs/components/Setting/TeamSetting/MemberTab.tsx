"use client";
import React, { useState, useEffect, useMemo } from "react";
import MemberCard from "./MemberCard";
import { useGetCompanyTeamMembers, useRemoveTeamMember } from "@/services/api/team-member";
import { useAuth } from "@/services/auth/context";
import { Tooltip } from "react-tooltip";
import { useModal } from "@/contexts/ModalManagerProvider";
import { MemberActionTooltip } from "@/components/Common/ToolTip/MemberActionTooltip";
import toast from "react-hot-toast";
import type { TeamMemberResponseDto } from "@qash/types/dto/team-member";
import { TeamMemberStatusEnum } from "@qash/types/enums";

interface Member {
  id: string;
  name: string;
  email: string;
  companyRole: string;
  role: string[];
}

interface MemberTabProps {
  onMenuClick: (memberId: string) => void;
}

const roleDisplay = (role?: string) => {
  if (!role) return "";
  switch (role) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    case "REVIEWER":
      return "Reviewer";
    case "VIEWER":
      return "Viewer";
    default:
      return role;
  }
};

const MemberTab: React.FC<MemberTabProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const companyId = user?.teamMembership?.companyId;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: teamMembers = [], isLoading } = useGetCompanyTeamMembers(
    companyId,
    { search: debouncedQuery },
    { enabled: !!companyId },
  );

  const members = useMemo<Member[]>(() => {
    return teamMembers.map((m: TeamMemberResponseDto) => ({
      id: String(m.id),
      name: `${m.firstName} ${m.lastName}`.trim(),
      email: m.user?.email || "",
      companyRole: m.position || "",
      role: [roleDisplay(m.role)],
    }));
  }, [teamMembers]);

  const { openModal } = useModal();
  const removeTeamMember = useRemoveTeamMember();

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Search and Create Bar */}
      <div className="flex items-center justify-between w-full">
        {/* Search Input */}
        <section className="flex flex-row items-center justify-between px-3 py-2 border border-primary-divider rounded-xl bg-app-background w-[200px]">
          <input
            type="text"
            placeholder="Search by name"
            className="text-sm text-text-primary outline-none placeholder-text-secondary w-full"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <img src="/misc/blue-search-icon.svg" alt="search" className="w-5 h-5" />
        </section>
      </div>

      {/* Members Cards Grid */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {isLoading && <p className="text-sm text-text-secondary">Loading...</p>}
        {!isLoading && teamMembers.length === 0 && <p className="text-sm text-text-secondary">No members found</p>}
        {teamMembers.map((m: TeamMemberResponseDto) => {
          const member = {
            id: String(m.id),
            name: `${m.firstName} ${m.lastName}`.trim(),
            email: m.user?.email || "",
            companyRole: m.position || "",
            role: [roleDisplay(m.role)],
            status: m.status,
          };

          const handleEdit = () => openModal("EDIT_TEAM_MEMBER", { id: Number(m.id) });

          const handleRemove = () => {
            openModal("REMOVE_TEAM_MEMBER", {
              name: `${m.firstName} ${m.lastName}`.trim(),
              onRemove: async () => {
                try {
                  await removeTeamMember.mutateAsync({ teamMemberId: Number(m.id), companyId: Number(companyId) });
                  toast.success("Team member removed");
                } catch (err) {
                  console.error("Failed to remove team member", err);
                  toast.error("Failed to remove member");
                }
              },
            });
          };

          return (
            <MemberCard
              key={member.id}
              member={member}
              onMenuClick={onMenuClick}
              onEdit={handleEdit}
              onRemove={handleRemove}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MemberTab;
