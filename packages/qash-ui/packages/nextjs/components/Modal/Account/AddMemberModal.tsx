"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Tooltip } from "react-tooltip";
import { AddMemberModalProps, SelectClientModalProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import { ModalHeader } from "../../Common/ModalHeader";
import BaseModal from "../BaseModal";
import { CustomCheckbox } from "@/components/Common/CustomCheckbox";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { CustomBlueCheckbox } from "@/components/Common/Checkbox/CustomBlueCheckbox";
import { MemberRoleTooltip } from "@/components/Common/ToolTip/MemberRoleTooltip";
import { TeamMemberRoleEnum, TeamMemberStatusEnum } from "@qash/types/enums";
import { useGetCompanyTeamMembers } from "@/services/api/team-member";
import { useGetMyCompany } from "@/services/api/company";
import { useAuth } from "@/services/auth/context";

interface MemberData {
  id: number;
  name: string;
  email: string;
  role: TeamMemberRoleEnum;
  companyRole?: string;
  avatar?: string;
  status: TeamMemberStatusEnum;
  isSelected?: boolean;
}

const MemberRow = ({
  member,
  onSelect,
  onRoleChange,
}: {
  member: MemberData;
  onSelect: (id: number) => void;
  onRoleChange: (id: number, role: TeamMemberRoleEnum) => void;
}) => {
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

  return (
    <div
      className={`flex items-center justify-between p-2 hover:bg-app-background rounded-lg transition-colors w-full ${member.status !== TeamMemberStatusEnum.ACTIVE ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => member.status === TeamMemberStatusEnum.ACTIVE && onSelect(member.id)}
    >
      <div className="flex gap-3 items-center flex-1">
        <CustomBlueCheckbox
          checked={member.isSelected ?? false}
          onChange={() => onSelect(member.id)}
          disabled={member.status !== TeamMemberStatusEnum.ACTIVE}
        />
        <div className="flex gap-1 items-center flex-1">
          <img
            src={member.avatar || "/misc/default-team-member-avatar.svg"}
            alt="avatar"
            className="w-8 h-8 rounded-full"
          />
          <div className="flex flex-col gap-1 w-full">
            <div className="flex gap-2 items-center w-full">
              <div className="flex flex-row items-center gap-1 justify-between w-full">
                <p className="text-sm font-medium text-text-primary leading-none">{member.name}</p>
              </div>
              {member.companyRole && (
                <span className="text-xs font-semibold text-primary-blue">{member.companyRole}</span>
              )}
            </div>
            <p className="text-xs font-medium text-text-secondary leading-none">{member.email}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-app-background transition-colors">
          {member.status === TeamMemberStatusEnum.PENDING && (
            <span className="text-sm italic text-text-secondary leading-none">Pending Invite</span>
          )}
          {member.status === TeamMemberStatusEnum.SUSPENDED && (
            <span className="text-sm italic text-text-secondary leading-none">Suspended</span>
          )}
          {getRoleIcon(member.role) && <img src={getRoleIcon(member.role)} alt={member.role} className="w-5 h-5" />}
          <p className="text-sm font-medium text-text-primary leading-none">{member.role}</p>
        </div>
      </div>
    </div>
  );
};

export function AddMemberModal({
  isOpen,
  onClose,
  onMembersSelected,
  selectedMembers = [],
}: ModalProp<AddMemberModalProps>) {
  const { data: company } = useGetMyCompany();
  const { data: teamMembersData, isLoading } = useGetCompanyTeamMembers(company?.id);
  const { user } = useAuth();

  const [members, setMembers] = useState<MemberData[]>([]);
  const [search, setSearch] = useState("");

  // Map API response to local state when data loads
  useEffect(() => {
    if (teamMembersData && user) {
      const mappedMembers: MemberData[] = teamMembersData
        .filter(tm => tm.user!.email !== user?.email)
        .map(tm => {
          const isSelected = selectedMembers.some(sm => String(sm.id) === String(tm.id));
          // Only allow selection if member is ACTIVE
          const selectable = tm.status === TeamMemberStatusEnum.ACTIVE;
          return {
            id: tm.id,
            name: `${tm.firstName} ${tm.lastName}`,
            email: tm.user!.email,
            role: tm.role,
            companyRole: tm.position,
            status: tm.status,
            isSelected: selectable ? isSelected : false,
          };
        });
      setMembers(mappedMembers);
    }
  }, [teamMembersData, user]);

  const selectedCount = members.filter(m => m.isSelected).length;
  const totalCount = members.length;

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const term = search.toLowerCase();
    return members.filter(
      member => member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term),
    );
  }, [members, search]);

  const handleSelectMember = (id: number) => {
    setMembers(prev =>
      prev.map(m =>
        m.id === id ? (m.status === TeamMemberStatusEnum.ACTIVE ? { ...m, isSelected: !m.isSelected } : m) : m,
      ),
    );
  };

  const handleRoleChange = (id: number, role: TeamMemberRoleEnum) => {
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, role } : m)));
  };

  const handleSelectAll = () => {
    setMembers(prev => prev.map(m => (m.status === TeamMemberStatusEnum.ACTIVE ? { ...m, isSelected: true } : m)));
  };

  const handleDeselectAll = () => {
    setMembers(prev => prev.map(m => ({ ...m, isSelected: false })));
  };

  const handleAddMembers = () => {
    const selectedMembers = members.filter(m => m.isSelected);
    if (onMembersSelected) {
      onMembersSelected(selectedMembers);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title="Add Members" onClose={onClose} />
      <div className="flex flex-col rounded-b-2xl border-2 bg-background border-primary-divider w-[650px] gap-3 py-4">
        {/* Search bar */}
        <div className="w-full px-6">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-app-background border border-primary-divider ">
            <input
              type="text"
              placeholder="Search by name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-text-primary placeholder-text-secondary outline-none text-sm"
            />
            <img src="/misc/blue-search-icon.svg" alt="search" className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Members list */}
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto px-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-secondary">Loading members...</p>
            </div>
          ) : filteredMembers.length > 0 ? (
            filteredMembers.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                onSelect={handleSelectMember}
                onRoleChange={handleRoleChange}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-secondary">No members found</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-primary-divider pt-4 px-6">
          <div className="flex gap-4 items-center">
            <div className="flex gap-1 items-center px-3 py-2">
              <p className="text-sm font-medium text-text-primary">
                {selectedCount}
                <span className="text-text-secondary">/{totalCount}</span>
              </p>
              <p className="text-sm font-medium text-text-secondary">Selected</p>
            </div>
            <button
              onClick={selectedCount === totalCount ? handleDeselectAll : handleSelectAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-app-background transition-colors"
            >
              <p className="text-sm font-medium text-primary-blue">
                {selectedCount === totalCount ? "Deselect all" : "Select all"}
              </p>
            </button>
          </div>
          <SecondaryButton
            onClick={handleAddMembers}
            disabled={selectedCount === 0}
            text="Add"
            buttonClassName="w-fit px-6"
          />
        </div>
      </div>
    </BaseModal>
  );
}

export default AddMemberModal;
