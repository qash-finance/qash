"use client";
import React, { useEffect, useRef, useState } from "react";
import { CreateAccountModalProps } from "@/types/modal";
import { ModalProp, useModal } from "@/contexts/ModalManagerProvider";
import { ModalHeader } from "../../Common/ModalHeader";
import BaseModal from "../BaseModal";
import InputFilled from "@/components/Common/Input/InputFilled";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { PrimaryButton } from "@/components/Common/PrimaryButton";
import { useCreateMultisigAccount } from "@/services/api/multisig";
import { useGetMyCompany } from "@/services/api/company";
import { useGetCompanyTeamMembers } from "@/services/api/team-member";
import { useAuth } from "@/services/auth/context";
import { useUploadMultisigLogo } from "@/services/api/upload";
import { usePSMProvider } from "@/contexts/PSMProvider";
import { useParaMiden } from "@miden-sdk/use-miden-para-react";
import { useWallet } from "@getpara/react-sdk-lite";
import { TeamMemberRoleEnum } from "@qash/types/enums";
import toast from "react-hot-toast";
import { NODE_ENDPOINT } from "@/services/utils/constant";

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRoleEnum;
  publicKey: string;
  commitment?: string;
  companyRole?: string;
  profilePicture?: string;
}

const TabHeader = ({ activeTab }: { activeTab: "detail" | "member" | "review" }) => {
  return (
    <div className="w-full flex justify-center">
      <div className="flex flex-row border-b border-primary-divider relative w-[600px]">
        <div className="flex items-center justify-center px-5 py-3 w-[200px] cursor-pointer group transition-colors duration-300">
          <p
            className={`font-medium text-base leading-6 transition-colors duration-300 ${
              activeTab === "detail" ? "" : "text-text-secondary"
            }`}
          >
            Account Details
          </p>
        </div>
        <div className="flex items-center justify-center px-5 py-3 w-[200px] cursor-pointer transition-colors duration-300">
          <p
            className={`font-medium text-base leading-6 transition-colors duration-300 ${
              activeTab === "member" ? "" : "text-text-secondary"
            }`}
          >
            Choose Members
          </p>
        </div>
        <div className="flex items-center justify-center px-5 py-3 w-[200px] cursor-pointer transition-colors duration-300">
          <p
            className={`font-medium text-base leading-6 transition-colors duration-300 ${
              activeTab === "review" ? "" : "text-text-secondary"
            }`}
          >
            Review
          </p>
        </div>
        <div
          className="absolute bottom-0 h-[3px] bg-primary-blue transition-all duration-300"
          style={{
            width: activeTab === "detail" ? "200px" : activeTab === "member" ? "400px" : "600px",
          }}
        />
      </div>
    </div>
  );
};

const MemberRow = ({
  profilePicture,
  name,
  email,
  companyRole,
  role,
}: {
  profilePicture?: string;
  name: string;
  email: string;
  companyRole: string;
  role: TeamMemberRoleEnum;
}) => {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex gap-2 items-center">
        {profilePicture ? (
          <img src={profilePicture} alt="avatar" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary-blue to-blue-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex gap-1 items-center">
            <p className="text-sm font-medium text-text-primary">{name}</p>
            {companyRole && <span className="text-xs font-semibold text-primary-blue">{companyRole}</span>}
          </div>
          <p className="text-xs font-medium text-text-secondary leading-none">{email}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {role === "OWNER" && <img src="/misc/purple-crown-icon.svg" alt="Owner" className="w-5" />}
        {role === "ADMIN" && <img src="/misc/green-shield-icon.svg" alt="Admin" className="w-5" />}
        {role === "VIEWER" && <img src="/misc/orange-eye-icon.svg" alt="Viewer" className="w-5" />}
        {role === "REVIEWER" && <img src="/misc/blue-note-icon.svg" alt="Reviewer" className="w-5" />}
        {role && <p className="text-sm font-medium text-text-primary">{role}</p>}
      </div>
    </div>
  );
};

export function CreateAccountModal({ isOpen, onClose }: ModalProp<CreateAccountModalProps>) {
  const { openModal } = useModal();
  const { data: company } = useGetMyCompany();
  const { data: teamMembersData } = useGetCompanyTeamMembers(company?.id);
  const { user } = useAuth();
  const createAccountMutation = useCreateMultisigAccount();
  const { multisigClient, psmCommitment, psmPublicKey, psmStatus } = usePSMProvider();
  const { para } = useParaMiden(NODE_ENDPOINT);
  const { data: wallet } = useWallet();

  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "member" | "review">("detail");
  const [thresholdDropdownOpen, setThresholdDropdownOpen] = useState(false);
  const [thresholdValue, setThresholdValue] = useState(1);
  const [selectedMembers, setSelectedMembers] = useState<MemberItem[]>([]);
  const [accountName, setAccountName] = useState("");
  const [accountDescription, setAccountDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const tabOrder = ["detail", "member", "review"] as const;

  // Auto-fill current user in selectedMembers
  useEffect(() => {
    if (teamMembersData && user && !isInitialized) {
      const currentUserMember = teamMembersData.find(tm => tm.user?.email === user.email);
      if (currentUserMember) {
        setSelectedMembers([
          {
            id: currentUserMember.id.toString(),
            name: `${currentUserMember.firstName} ${currentUserMember.lastName}`,
            email: currentUserMember.user!.email,
            role: currentUserMember.role,
            companyRole: currentUserMember.position,
            publicKey: currentUserMember.user!.publicKey,
            commitment: currentUserMember.user?.commitment,
            profilePicture: currentUserMember.profilePicture || undefined,
          },
        ]);
        setIsInitialized(true);
      }
    }
  }, [teamMembersData, user, isInitialized]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadLogoMutation = useUploadMultisigLogo();

  const resetState = () => {
    setIsSuccess(false);
    setActiveTab("detail");
    setThresholdDropdownOpen(false);
    setThresholdValue(1);
    setSelectedMembers([]);
    setAccountName("");
    setAccountDescription("");
    setLogoUrl(null);
    setCreatedAccountId("");
    setIsLoading(false);
    setIsInitialized(false);
    if (fileInputRef.current) {
      try {
        fileInputRef.current.value = "";
      } catch (e) {
        // ignore
      }
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const resp = await uploadLogoMutation.mutateAsync(file);
      setLogoUrl(resp.url);
      toast.success("Logo uploaded");
    } catch (err) {
      console.error("Logo upload failed", err);
      toast.error("Failed to upload logo");
    }
  };

  const goNext = () => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
  };

  const goBack = () => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx === 0) return onClose();
    setActiveTab(tabOrder[idx - 1]);
  };

  const handleThresholdChange = (value: number) => {
    setThresholdValue(value);
    setThresholdDropdownOpen(false);
  };

  const handleOpenAddMemberModal = () => {
    openModal("ADD_MEMBER", {
      onMembersSelected: (members: any) => {
        // Merge new members with existing ones, avoiding duplicates
        const newMembers = members as MemberItem[];
        const mergedMembers = [
          ...selectedMembers,
          ...newMembers.filter(nm => !selectedMembers.some(sm => sm.id === nm.id)),
        ];
        setSelectedMembers(mergedMembers);
      },
      selectedMembers: selectedMembers,
    });
  };

  const handleRemoveMember = (id: string) => {
    // Prevent removing the current user (auto-filled member)
    if (user && selectedMembers.length > 0) {
      const memberToRemove = selectedMembers.find(m => m.id === id);
      if (memberToRemove && memberToRemove.email === user.email) {
        return; // Don't allow removal of current user
      }
    }
    setSelectedMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleCreateAccount = async () => {
    if (!company || selectedMembers.length === 0) {
      console.error("Missing company or members");
      return;
    }

    if (!multisigClient || psmStatus !== "connected") {
      toast.error("PSM not connected. Please wait and try again.");
      return;
    }

    if (!para) {
      toast.error("Para wallet not connected. Please reconnect.");
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get current user's commitment and public key
      const currentUser = selectedMembers.find(m => m.email === user?.email);
      const currentUserCommitment = currentUser?.commitment;
      const currentUserPublicKey = currentUser?.publicKey || wallet?.publicKey;

      if (!currentUserCommitment) {
        throw new Error("Your wallet commitment is not available. Please log out and log in again.");
      }
      if (!currentUserPublicKey) {
        throw new Error("Your wallet public key is not available. Please reconnect.");
      }

      // 2. Collect other members' commitments
      const otherMembers = selectedMembers.filter(m => m.email !== user?.email);
      const otherCommitments: string[] = [];
      for (const m of otherMembers) {
        if (!m.commitment) {
          throw new Error(`Missing commitment for team member "${m.name}". They need to log in first.`);
        }
        otherCommitments.push(m.commitment);
      }

      // 3. Import ParaSigner from OZ SDK (MultisigClient already initialized via PSMProvider)
      const { ParaSigner } = await import("@openzeppelin/miden-multisig-client");

      // 4. Get wallet ID for ParaSigner
      const walletId = wallet?.id;
      if (!walletId) {
        throw new Error("Para wallet ID not available. Please reconnect.");
      }

      // 5. Create ParaSigner
      const signer = new ParaSigner(para as any, walletId, currentUserCommitment, currentUserPublicKey);

      // 6. Build signer commitments (current user first, then others)
      const allCommitments = [currentUserCommitment, ...otherCommitments];

      // 7. Create multisig account on-chain
      const config = {
        threshold: thresholdValue,
        signerCommitments: allCommitments,
        psmCommitment,
        psmPublicKey,
        psmEnabled: true,
        storageMode: "private" as const,
        signatureScheme: "ecdsa" as const,
      };

      console.log("Creating multisig account on-chain:", {
        threshold: thresholdValue,
        signerCount: allCommitments.length,
      });

      const ms = await multisigClient.create(config, signer);

      // 8. Register on PSM
      console.log("Registering multisig on PSM...");
      await ms.registerOnPsm();

      // 9. Extract accountId from the created multisig
      const accountId = ms.accountId;
      console.log("Multisig account created:", accountId);

      // 10. Send accountId + publicKeys to backend for storage
      const teamMemberIds = selectedMembers.map(member => member.id.toString());
      const response = await createAccountMutation.mutateAsync({
        accountId,
        publicKeys: allCommitments,
        name: accountName,
        description: accountDescription,
        teamMemberIds,
        threshold: thresholdValue,
        companyId: company.id as number,
        logo: logoUrl || undefined,
      });

      setCreatedAccountId(response.accountId);
      setIsSuccess(true);
      toast.success("Multisig account created successfully!");
    } catch (error) {
      console.error("Failed to create multisig account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create multisig account");
    } finally {
      setIsLoading(false);
    }
  };

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

  useEffect(() => {
    if (!isOpen && isSuccess) {
      resetState();
    }
  }, [isOpen]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "detail":
        return (
          <>
            <span className="text-3xl">Create new account</span>

            <div className="relative group" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
              <div className="flex justify-center items-center w-20 h-20 rounded-full border border-primary-divider overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Account logo" className="w-full h-full object-cover" />
                ) : (
                  <img src="/setting/new-account.svg" alt="Create Account Illustration" className="w-full h-full" />
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                  {uploadLogoMutation.isPending ? (
                    <div className="w-6 h-6 border-2 border-white rounded-full animate-spin" />
                  ) : (
                    <img src="/misc/upload-icon.svg" alt="Overlay Icon" className="w-6 h-6" />
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileChange}
              />
            </div>

            <div className="w-[600px] flex flex-col gap-2">
              <InputFilled
                label="Set account name"
                placeholder="Enter account name"
                value={accountName}
                onChange={(e: any) => setAccountName(e.target.value)}
              />
              <InputFilled
                label="Description"
                placeholder="Enter description"
                optional
                type="textarea"
                value={accountDescription}
                onChange={(e: any) => setAccountDescription(e.target.value)}
              />
            </div>
          </>
        );
      case "member":
        return (
          <>
            <span className="text-3xl">Member and threshold configuration</span>

            {/* Members Section */}
            <div className="w-[600px] flex flex-col gap-3">
              {/* Members Tab */}
              <div className="bg-app-background rounded-2xl p-0 overflow-hidden">
                {/* Tab Header */}
                <div className="border-b border-primary-divider flex items-center justify-between px-4 py-3">
                  <div className="flex gap-4 items-center">
                    <p className="text-base font-medium text-text-primary">Members</p>
                    <span className="text-base font-medium text-text-secondary">{selectedMembers.length}</span>
                  </div>

                  <button
                    onClick={handleOpenAddMemberModal}
                    className="flex gap-2 items-center px-4 py-1.5 bg-background shadow-md rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <span className="leading-none mb-0.5 text-lg">+</span>
                    <p className="text-sm">Add</p>
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex flex-col px-2 py-2">
                  {selectedMembers.length === 0 ? (
                    <div
                      className="flex flex-col gap-2 items-center justify-center h-[250px] cursor-pointer"
                      onClick={handleOpenAddMemberModal}
                    >
                      <div className="w-12 h-12 rounded-full border border-primary-divider flex items-center justify-center bg-background shadow-md">
                        <span className="leading-none text-4xl mb-1 text-text-secondary">+</span>
                      </div>
                      <p className="text-sm font-semibold text-text-secondary text-center">Choose members from Qash</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-[250px] overflow-y-auto">
                      {selectedMembers.map(member => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 hover:bg-background rounded-lg transition-colors"
                        >
                          <div className="flex gap-2 items-center flex-1">
                            {member.profilePicture ? (
                              <img src={member.profilePicture} alt="avatar" className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary-blue to-blue-600 flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-white">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex gap-2 items-center">
                                <p className="text-sm font-medium text-text-primary leading-none">{member.name}</p>
                                {member.companyRole && (
                                  <span className="text-xs font-semibold text-primary-blue">{member.companyRole}</span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-text-secondary leading-none">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg">
                              {getRoleIcon(member.role) && (
                                <img src={getRoleIcon(member.role)} alt={member.role} className="w-5 h-5" />
                              )}
                              <p className="text-sm font-medium text-text-primary capitalize">
                                {member.role.toLowerCase()}
                              </p>
                            </div>
                            {user?.email === member.email ? (
                              <button
                                disabled
                                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed"
                              >
                                You
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Threshold Section */}
              <div className="flex gap-4 items-start">
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-base font-medium text-text-primary leading-none">Threshold</p>
                  <p className="text-xs font-medium text-text-secondary leading-none">
                    Any transaction requires the confirmation of
                  </p>
                </div>
                <div className="flex gap-2.5 items-center">
                  <div className="relative">
                    <button
                      onClick={() => setThresholdDropdownOpen(!thresholdDropdownOpen)}
                      className="bg-background border border-primary-divider border-solid flex gap-2 items-center px-4 py-1 relative rounded-lg cursor-pointer"
                    >
                      <p className="font-medium leading-6 text-base text-text-primary">{thresholdValue}</p>
                      <img alt="dropdown" className="w-4" src="/arrow/chevron-down.svg" />
                    </button>

                    {thresholdDropdownOpen && selectedMembers.length > 0 && (
                      <div className="absolute bottom-full right-0 mb-1 bg-background border border-primary-divider rounded-lg shadow-lg z-10">
                        {Array.from({ length: selectedMembers.length }, (_, i) => i + 1).map((option, index) => (
                          <button
                            key={option}
                            onClick={() => handleThresholdChange(option)}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                              option === thresholdValue ? "bg-blue-50 font-medium" : ""
                            } ${index === 0 ? "rounded-t-lg" : ""} ${index === selectedMembers.length - 1 ? "rounded-b-lg" : ""}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-text-primary whitespace-nowrap">
                    out of {selectedMembers.length} admin members
                  </p>
                </div>
              </div>
            </div>
          </>
        );
      case "review":
        return (
          <>
            <div className="flex flex-col gap-2 items-center">
              <span className="text-3xl leading-none">Review your account</span>
              <span className="text-sm text-text-secondary leading-none">
                Make sure everything looks correct before you proceed.
              </span>
            </div>

            {/* Account Info Card */}
            <div className="w-[600px] flex flex-col gap-2 bg-app-background rounded-2xl p-4 overflow-hidden">
              {/* Header with Avatar and Title */}
              <div className="flex flex-col gap-2 border-b border-primary-divider pb-2">
                <div className="w-16 h-16 rounded-full border border-primary-divider flex items-center justify-center bg-background">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Account logo" className="w-full h-full object-cover" />
                  ) : (
                    <img src="/setting/new-account.svg" alt="Account" className="w-full h-full" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-4xl font-medium text-text-primary">{accountName}</h3>
                  <p className="text-base font-medium text-text-secondary">
                    {accountDescription || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="flex gap-2.5 py-1">
                {/* Members Card */}
                <div className="flex-1 bg-background rounded-lg px-4 py-2 flex flex-col gap-1 justify-center shadow-sm">
                  <p className="text-2xl font-semibold text-text-primary">{selectedMembers.length}</p>
                  <p className="text-base font-medium text-text-secondary">Members</p>
                </div>

                {/* Threshold Card */}
                <div className="flex-1 bg-background rounded-lg px-4 py-2 flex flex-col gap-1 justify-center shadow-sm">
                  <p className="text-2xl font-semibold text-text-primary">
                    {thresholdValue}/{selectedMembers.length || 10}
                  </p>
                  <p className="text-base font-medium text-text-secondary">Threshold</p>
                </div>

                {/* Deploy Fee Card */}
                {/* <div className="flex-1 bg-background rounded-lg px-4 py-2 flex flex-col gap-1 justify-center shadow-sm">
                  <p className="text-2xl font-semibold text-text-primary">~0.004</p>
                  <p className="text-base font-medium text-text-secondary">Deploy fee</p>
                </div> */}
              </div>

              {/* Members List */}
              <div className="bg-background rounded-lg p-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {selectedMembers.length > 0 ? (
                  selectedMembers.map(member => (
                    <MemberRow
                      key={member.id}
                      profilePicture={member.profilePicture}
                      name={member.name}
                      companyRole={member.companyRole || ""}
                      email={member.email}
                      role={member.role}
                    />
                  ))
                ) : (
                  <p className="text-text-secondary text-center py-4">No members selected</p>
                )}
              </div>
            </div>
          </>
        );
    }
  };

  if (!isOpen) return null;
  return (
    <BaseModal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader title="Create new account" onClose={handleClose} icon="/misc/create-account-icon.svg" />
      <div className="flex flex-col w-[800px] p-4 justify-center  rounded-b-2xl items-center border-2  border-primary-divider bg-background gap-5">
        {!isSuccess ? (
          <>
            <TabHeader activeTab={activeTab} />
            {renderTabContent()}
            <div className="w-[600px] flex flex-row gap-2">
              <SecondaryButton
                text="Back"
                onClick={goBack}
                buttonClassName="flex-1"
                icon="/arrow/chevron-left.svg"
                iconPosition="left"
                variant="light"
                disabled={activeTab === "detail"}
              />
              <PrimaryButton
                text={activeTab === "review" ? "Create" : "Next"}
                onClick={() => {
                  if (activeTab === "review") {
                    handleCreateAccount();
                    return;
                  }

                  goNext();
                }}
                loading={isLoading}
                disabled={
                  isLoading ||
                  (activeTab === "member" && selectedMembers.length === 0) ||
                  (activeTab === "detail" && accountName.trim() === "")
                }
                containerClassName={`flex-1`}
              />
            </div>
          </>
        ) : (
          <div className="flex justify-center items-center flex-col rounded-3xl border border-primary-divider relative overflow-hidden w-[600px]">
            <div
              className="absolute inset-0 w-full h-full z-0"
              style={{
                background: "url('/onboarding/complete-background.svg')",
                backgroundSize: "cover",
                filter: "blur(8px)",
              }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full py-10 gap-4">
              <img src="/onboarding/hexagon-avatar.svg" alt="Onboarding Complete" className="w-[180px] h-[180px]" />

              <div className="w-full flex items-center justify-center gap-2 flex-col">
                <span className="font-bold text-2xl leading-none">Your account is ready!</span>
                <span className="text-sm text-text-secondary leading-none">
                  Below are the wallet details and the transaction that created it.
                </span>
              </div>

              <div className="w-fit bg-background rounded-xl border border-primary-divider shadow-md px-2 py-4 flex flex-row items-center justify-between gap-2 ">
                <span className="text-text-secondary text-sm">Account ID:</span>
                <span className="text-xs font-mono">{createdAccountId.substring(0, 20)}...</span>
                <img
                  src="/misc/copy-icon.svg"
                  alt="Copy"
                  className="w-4 cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(createdAccountId);
                    toast.success("Address copied to clipboard");
                  }}
                />
              </div>

              <div className="w-full flex items-center justify-center gap-2 flex-row px-20">
                <PrimaryButton
                  text="View Account"
                  containerClassName="flex-1"
                  onClick={() => {
                    handleClose();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

export default CreateAccountModal;
