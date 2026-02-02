"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/services/auth/context";
import { useUpdateTeamMember, useUpdateAvatar } from "@/services/api/team-member";
import { SecondaryButton } from "../Common/SecondaryButton";
import SettingHeader from "./SettingHeader";
import { TeamMemberRoleEnum } from "@qash/types/enums";
import { useUploadAvatar } from "@/services/api/upload";
import toast from "react-hot-toast";

export default function AccountSettings() {
  const { user } = useAuth();
  const updateMutation = useUpdateTeamMember();
  const updateAvatarMutation = useUpdateAvatar();
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const uploadAvatarMutation = useUploadAvatar();

  const displayName = user?.teamMembership ? `${user.teamMembership.firstName} ${user.teamMembership.lastName}` : "N/A";
  const email = user?.email || "N/A";

  const handleEditClick = () => {
    setName(displayName);
    setIsEditingName(true);
  };

  const handleUpdateName = async () => {
    if (!user?.teamMembership?.id) {
      console.error("Missing user information");
      return;
    }

    // Split name into firstName and lastName
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    try {
      await updateMutation.mutateAsync({
        teamMemberId: user.teamMembership.id,
        updateDto: {
          firstName,
          lastName,
        },
      });
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update name:", error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setName("");
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case TeamMemberRoleEnum.ADMIN:
        return "/misc/green-shield-icon.svg";
      case TeamMemberRoleEnum.VIEWER:
        return "/misc/orange-eye-icon.svg";
      case TeamMemberRoleEnum.REVIEWER:
        return "/misc/blue-note-icon.svg";
      case TeamMemberRoleEnum.OWNER:
        return "/misc/purple-crown-icon.svg";
      default:
        return "/misc/orange-eye-icon.svg";
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPEG and PNG files are allowed");
      return;
    }

    // Validate file size (max 10MB for avatar)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setAvatarFile(file);

    try {
      // Step 1: Upload file to S3
      const uploadResult = await uploadAvatarMutation.mutateAsync(file);
      const uploadedUrl = uploadResult.url;
      setAvatarUrl(uploadedUrl);

      // Step 2: Persist avatar URL to database
      if (!user?.teamMembership?.id) {
        toast.error("Unable to update avatar: missing user information");
        return;
      }

      await updateAvatarMutation.mutateAsync({
        teamMemberId: user.teamMembership.id,
        profilePicture: uploadedUrl,
      });

      toast.success("Avatar uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload avatar");
      setAvatarFile(null);
      // Reset avatar URL if persistence failed
      setAvatarUrl(null);
    }
  };

  useEffect(() => {
    if (user?.teamMembership?.profilePicture && !avatarUrl) {
      setAvatarUrl(user.teamMembership.profilePicture);
    }
  }, [user]);

  return (
    <div className="flex flex-col">
      <SettingHeader icon="/misc/user-hexagon-icon.svg" title="Account" />
      <div className="border border-primary-divider rounded-2xl p-5 flex flex-row gap-4 max-w-xl items-center justify-around">
        {/* Avatar Upload */}
        <div className="flex gap-4 items-center flex-col">
          <label className="bg-[#ebf4ff] border border-primary-blue border-dashed rounded-full shrink-0 w-[86px] h-[86px] flex items-center justify-center relative overflow-hidden cursor-pointer hover:bg-blue-50 transition-colors">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <img src="/misc/blue-upload-icon.svg" alt="Upload" className="w-6 h-6" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleAvatarUpload}
              disabled={uploadAvatarMutation.isPending}
              className="hidden"
            />
          </label>
          <label
            className="border border-primary-divider rounded-lg px-3 py-1.5 w-fit font-barlow font-medium text-[14px] text-text-primary leading-[20px] tracking-[-0.56px] hover:bg-base-container-sub-background transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              pointerEvents: uploadAvatarMutation.isPending ? "none" : "auto",
              opacity: uploadAvatarMutation.isPending ? 0.5 : 1,
            }}
          >
            {uploadAvatarMutation.isPending ? "Uploading..." : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleAvatarUpload}
              disabled={uploadAvatarMutation.isPending}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name Section */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-text-secondary leading-5 tracking-[-0.21px]">Name</label>

            {!isEditingName ? (
              <div className="flex items-start justify-between w-full">
                <p className="text-base font-medium text-text-primary leading-6 tracking-[-0.32px]">{displayName}</p>
                <button
                  onClick={handleEditClick}
                  className="w-5 h-5 flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                >
                  <img src="/misc/edit-icon.svg" alt="Edit" className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="bg-[#F5F5F6] rounded-lg px-3 py-1 flex items-center gap-2 w-full relative">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-transparent text-sm font-medium text-text-primary leading-5 tracking-[-0.56px] outline-none w-full"
                    placeholder="Enter name"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end">
                  <div className="flex gap-2">
                    <SecondaryButton onClick={handleCancelEdit} text="Cancel" variant="light" buttonClassName="px-4" />
                    <SecondaryButton
                      onClick={handleUpdateName}
                      text={updateMutation.isPending ? "Updating..." : "Update"}
                      buttonClassName="px-4"
                      disabled={updateMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Email Section */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-text-secondary leading-5 tracking-[-0.21px]">Email</label>
            <div className="flex items-start w-full">
              <p className="text-base font-medium text-text-primary leading-6 tracking-[-0.32px]">{email}</p>
            </div>
          </div>

          {/* Role Section */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-text-secondary leading-5 tracking-[-0.21px]">Role</label>
            <div className="flex items-center w-full justify-start">
              <img src={getRoleIcon(user?.teamMembership?.role)} alt="Role Icon" className="w-5 h-5 mr-2" />
              <p className="text-base font-medium text-text-primary capitalize leading-6 tracking-[-0.32px]">
                {user?.teamMembership?.role.toLocaleLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
