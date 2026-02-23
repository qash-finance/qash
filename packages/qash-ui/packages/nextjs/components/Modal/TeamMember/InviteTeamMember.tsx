"use client";
import React, { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Tooltip } from "react-tooltip";
import { ValidatingModalProps } from "@/types/modal";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "../BaseModal";
import { PrimaryButton } from "../../Common/PrimaryButton";
import { SecondaryButton } from "../../Common/SecondaryButton";
import { useAuth } from "@/services/auth/context";
import {
  useGetCompanyTeamMembers,
  useInviteTeamMember,
  useBulkInviteTeamMembers,
  useUpdateTeamMemberRole,
} from "@/services/api/team-member";
import { TeamMemberRoleEnum, TeamMemberStatusEnum } from "@qash/types/enums";
import { InviteTeamMemberDto } from "@qash/types/dto/team-member";
import { MemberRoleTooltip } from "../../Common/ToolTip/MemberRoleTooltip";
import toast from "react-hot-toast";
import { trackEvent } from "@/services/analytics/posthog";
import { PostHogEvent } from "@/types/posthog";

interface InviteFormData {
  emailInput: string;
  invitedEmails: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: TeamMemberRoleEnum;
  }>;
}

export function InviteTeamMember({ isOpen, onClose, zIndex }: ModalProp<ValidatingModalProps>) {
  const { user } = useAuth();
  const companyId = user?.teamMembership?.companyId;
  const [selectedMemberIdForRole, setSelectedMemberIdForRole] = useState<number | null>(null);
  const {
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: {
      emailInput: "",
      invitedEmails: [],
    },
  });

  const emailInput = watch("emailInput");
  const invitedEmails = watch("invitedEmails");

  // Fetch team members for the company
  const { data: teamMembers = [], refetch: refetchTeamMembers } = useGetCompanyTeamMembers(companyId);

  // Mutation hooks
  const inviteMutation = useInviteTeamMember();
  const bulkInviteMutation = useBulkInviteTeamMembers();
  const updateRoleMutation = useUpdateTeamMemberRole();

  const isLoading = inviteMutation.isPending || bulkInviteMutation.isPending || updateRoleMutation.isPending;

  // Handle email input - add email on comma or Enter
  const handleEmailChange = (value: string) => {
    setValue("emailInput", value);

    if (value.endsWith(", ") || value.endsWith(",")) {
      const emailToAdd = value.slice(0, -1).trim();
      // Don't allow inviting if the email is already a team member (active or pending)
      const existingMember = teamMembers.find(tm => tm.user?.email === emailToAdd);
      if (existingMember) {
        if (existingMember.status === TeamMemberStatusEnum.PENDING) {
          toast.error(`${emailToAdd} has already been invited.`);
        } else {
          toast.error(`${emailToAdd} is already a team member.`);
        }
        setValue("emailInput", "");
        return;
      }

      if (isValidEmail(emailToAdd) && !invitedEmails.find(e => e.email === emailToAdd)) {
        const newEmail = {
          id: Date.now().toString(),
          email: emailToAdd,
          firstName: emailToAdd.split("@")[0],
          lastName: "",
          role: TeamMemberRoleEnum.VIEWER,
        };
        setValue("invitedEmails", [...invitedEmails, newEmail]);
        setValue("emailInput", "");
      }
    }
  };

  // Remove invited email
  const handleRemoveEmail = (id: string) => {
    setValue(
      "invitedEmails",
      invitedEmails.filter(item => item.id !== id),
    );
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Derive first and last name from email when missing
  const deriveNamesFromEmail = (email: string, first?: string, last?: string) => {
    const [local, domain] = email.split("@");
    const domainPart = domain ? domain.split(".")[0] : "";
    const firstName = first && first.trim() !== "" ? first : local || "";
    const lastName = last && last.trim() !== "" ? last : domainPart || "";
    return { firstName, lastName };
  };

  // Handle invite submission
  const onSubmit = async (data: InviteFormData) => {
    if (data.invitedEmails.length === 0) return;
    if (!companyId) return;

    try {
      if (data.invitedEmails.length === 1) {
        // Single invite
        const candidate = data.invitedEmails[0];
        const { firstName, lastName } = deriveNamesFromEmail(candidate.email, candidate.firstName, candidate.lastName);
        const inviteDto: InviteTeamMemberDto = {
          email: candidate.email,
          firstName,
          lastName,
          role: candidate.role,
        };
        await inviteMutation.mutateAsync({
          companyId,
          inviteDto,
        });

        toast.success(`Invitation sent to ${candidate.email}`);
        trackEvent(PostHogEvent.TEAM_MEMBER_INVITED, { email: candidate.email, role: candidate.role });
      } else {
        // Bulk invite - filter out emails that are already team members or pending
        const duplicates = data.invitedEmails.filter(e => teamMembers.some(tm => tm.user?.email === e.email));
        const toInvite = data.invitedEmails.filter(e => !teamMembers.some(tm => tm.user?.email === e.email));

        if (duplicates.length > 0 && toInvite.length === 0) {
          toast.error(`All selected emails are already members or have pending invites.`);
          return;
        }

        if (duplicates.length > 0) {
          // Let user know some were skipped
          const skipped = duplicates.map(d => d.email).join(", ");
          toast(`${toInvite.length} invitations will be sent. Skipped existing/pending: ${skipped}`, { icon: "⚠️" });
        }

        const bulkInviteDto = {
          members: toInvite.map(e => {
            const { firstName, lastName } = deriveNamesFromEmail(e.email, e.firstName, e.lastName);
            return {
              email: e.email,
              firstName,
              lastName,
              role: e.role,
            };
          }),
        };

        await bulkInviteMutation.mutateAsync({
          companyId,
          bulkInviteDto,
        });

        toast.success(`Invitations sent to ${toInvite.length} members`);
        trackEvent(PostHogEvent.TEAM_MEMBERS_BULK_INVITED, { count: toInvite.length });
      }
      reset();
      refetchTeamMembers();
    } catch (error) {
      console.error("Failed to invite team members:", error);
    }
  };

  // Format team members for display
  const displayTeamMembers = useMemo(() => {
    return teamMembers.map(member => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      email: member.user?.email || "",
      role: member.role,
      isCurrentUser: user?.email === member.user?.email,
    }));
  }, [teamMembers, user?.email]);

  const renderRoleIcon = (role: TeamMemberRoleEnum) => {
    if (role === TeamMemberRoleEnum.REVIEWER || role === TeamMemberRoleEnum.VIEWER) {
      return "/misc/orange-eye-icon.svg";
    }
    if (role === TeamMemberRoleEnum.ADMIN) {
      return "/misc/green-shield-icon.svg";
    }
  };

  // Handle role change for team members
  const handleRoleChange = async (newRole: TeamMemberRoleEnum) => {
    if (!selectedMemberIdForRole) return;

    try {
      await updateRoleMutation.mutateAsync({
        teamMemberId: selectedMemberIdForRole,
        updateRoleDto: {
          role: newRole,
        },
      });
      toast.success("Role updated successfully");
      setSelectedMemberIdForRole(null);
      refetchTeamMembers();
    } catch (error) {
      console.error("Failed to update team member role:", error);
      toast.error("Failed to update role");
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col w-150 rounded-3xl overflow-hidden border border-primary-divider bg-background"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-primary-divider">
          <h2 className="text-base font-semibold text-text-primary">Invite new member</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-lg bg-app-background border-b-2 border-secondary-divider hover:opacity-80 transition-opacity"
          >
            <img src="/misc/close-icon.svg" alt="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 px-6 py-5">
          {/* Email Input Section */}
          <div className="flex w-full justify-between items-center bg-app-background border-b-2 border-primary-divider py-2 px-3 rounded-xl gap-3">
            <div className="flex-1 flex flex-row gap-3 items-center justify-start flex-wrap">
              {/* Invited Emails Chips */}
              {invitedEmails.length > 0 && (
                <div className="flex flex-row gap-2 flex-wrap">
                  {invitedEmails.map(invitedEmail => (
                    <div key={invitedEmail.id} className="flex gap-2 items-center rounded-lg bg-white px-3 py-1">
                      <p className="font-medium text-sm">{invitedEmail.email}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(invitedEmail.id)}
                        className="flex items-center justify-center w-4 h-4 hover:opacity-80 transition-opacity"
                        aria-label={`Remove ${invitedEmail.email}`}
                      >
                        <img src="/misc/close-icon.svg" alt="remove" className="w-2" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Controller
                name="emailInput"
                control={control}
                render={({ field }) => (
                  <input
                    type="text"
                    placeholder="Enter email"
                    className="flex-1 min-w-fit text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-primary-blue transition-colors"
                    {...field}
                    onChange={e => handleEmailChange(e.target.value)}
                    disabled={isLoading}
                  />
                )}
              />
            </div>
            <PrimaryButton
              text="Invite"
              type="button"
              onClick={() => {
                if (emailInput.trim() && isValidEmail(emailInput.trim())) {
                  if (!companyId) {
                    console.error("Company ID is missing. Cannot invite team member.");
                    return;
                  }

                  if (invitedEmails.length === 0) {
                    // No emails invited yet, submit with the current input directly
                    const candidateEmail = emailInput.trim();
                    const existingMember = teamMembers.find(tm => tm.user?.email === candidateEmail);
                    if (existingMember) {
                      if (existingMember.status === TeamMemberStatusEnum.PENDING) {
                        toast.error(`${candidateEmail} has already been invited.`);
                      } else {
                        toast.error(`${candidateEmail} is already a team member.`);
                      }
                      return;
                    }

                    const { firstName, lastName } = deriveNamesFromEmail(candidateEmail);
                    const inviteDto: InviteTeamMemberDto = {
                      email: candidateEmail,
                      firstName,
                      lastName,
                      role: TeamMemberRoleEnum.VIEWER,
                    };
                    inviteMutation
                      .mutateAsync({
                        companyId,
                        inviteDto,
                      })
                      .then(() => {
                        reset();
                        refetchTeamMembers();
                      })
                      .catch(error => {
                        console.error("Failed to invite team member:", error);
                      });
                  } else {
                    // Already have invited emails, add this one to the list
                    handleEmailChange(emailInput + ", ");
                  }
                }
              }}
              disabled={!emailInput.trim() || !isValidEmail(emailInput.trim()) || isLoading}
              containerClassName="w-[70px] flex-shrink-0"
            />
          </div>

          {/* Who has access Section */}
          <div className="flex flex-col gap-3 mt-2 max-h-75 overflow-y-auto">
            <h3 className="text-sm font-medium text-text-secondary">Who has access</h3>

            {/* Team Members List */}
            <div className="flex flex-col gap-3">
              {displayTeamMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between">
                  {/* Member Info */}
                  <div className="flex items-center gap-3 flex-1">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary-blue to-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-white">
                        {`${member.name.charAt(0)}`.toUpperCase()}
                      </span>
                    </div>

                    {/* Name and Email */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {member.name}
                          {member.isCurrentUser && " (You)"}
                        </p>
                      </div>
                      <p className="text-xs text-text-secondary truncate">{member.email}</p>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {member.role === TeamMemberRoleEnum.OWNER && (
                      <img src="/misc/purple-crown-icon.svg" alt="owner" className="w-5 h-5" />
                    )}
                    {member.role !== TeamMemberRoleEnum.OWNER && (
                      <img src={renderRoleIcon(member.role)} alt={member.role.toLowerCase()} className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium text-text-primary whitespace-nowrap capitalize">
                      {member.role.toLowerCase()}
                    </span>
                    {user?.email !== member.email && (
                      <>
                        <button
                          type="button"
                          data-tooltip-id={`role-tooltip-${member.id}`}
                          className="flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                          onClick={() => setSelectedMemberIdForRole(member.id)}
                        >
                          <img src="/arrow/chevron-down.svg" alt="chevron right" className="w-5" />
                        </button>
                        <Tooltip
                          id={`role-tooltip-${member.id}`}
                          clickable
                          style={{ zIndex: zIndex ? zIndex + 10 : 1000, borderRadius: "16px", padding: "0" }}
                          place="left"
                          noArrow
                          border="none"
                          opacity={1}
                          render={() => <MemberRoleTooltip currentRole={member.role} onRoleChange={handleRoleChange} />}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {displayTeamMembers.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-text-secondary">No team members yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-primary-divider">
          <SecondaryButton text="Done" onClick={onClose} disabled={isLoading} buttonClassName="w-[120px]" />
        </div>
      </form>
    </BaseModal>
  );
}

export default InviteTeamMember;
