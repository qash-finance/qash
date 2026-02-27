"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Welcome from "../Common/Welcome";
import { PrimaryButton } from "../Common/PrimaryButton";
import InputOutlined from "../Common/Input/InputOutlined";
import { CompanyTypeDropdown } from "../Common/Dropdown/CompanyTypeDropdown";
import { CountryDropdown } from "../Common/Dropdown/CountryDropdown";
import { SecondaryButton } from "../Common/SecondaryButton";
import { FileUpload } from "./FileUpload";
import { useCreateCompany } from "@/services/api/company";
import { useUploadCompanyLogo } from "@/services/api/upload";
import toast from "react-hot-toast";
import { useAuth } from "@/services/auth/context";
import { User } from "@/types/user";
import { CompanyTypeEnum } from "@qash/types/enums";
import { trackEvent } from "@/services/analytics/posthog";
import { PostHogEvent } from "@/types/posthog";

type Step = "company" | "team" | "complete";

interface OnboardingFormData {
  firstName: string;
  lastName: string;
  companyName: string;
  country: string;
  companyType: string;
  city: string;
  address1: string;
  address2: string;
  postalCode: string;
  registrationNumber: string;
}

// Map display names to enum values
const mapCompanyTypeToEnum = (displayName: string): CompanyTypeEnum => {
  const mapping: Record<string, CompanyTypeEnum> = {
    "Sole Proprietorship": CompanyTypeEnum.SOLE_PROPRIETORSHIP,
    Partnership: CompanyTypeEnum.PARTNERSHIP,
    "LLP – Limited Liability Partnership": CompanyTypeEnum.PARTNERSHIP,
    "LLC – Limited Liability Company": CompanyTypeEnum.LLC,
    "Private Limited Company (Ltd / Pte Ltd)": CompanyTypeEnum.CORPORATION,
    "Corporation (Inc. / Corp.)": CompanyTypeEnum.CORPORATION,
    "Public Limited Company (PLC)": CompanyTypeEnum.CORPORATION,
    "Non-Profit Organization": CompanyTypeEnum.OTHER,
  };
  return mapping[displayName] || CompanyTypeEnum.OTHER;
};

export default function OnboardingContainer() {
  const router = useRouter();
  const { isAuthenticated, user, refreshUser } = useAuth();
  const createCompanyMutation = useCreateCompany();
  const uploadLogoMutation = useUploadCompanyLogo();
  const [step, setStep] = useState<Step>("company");
  const [selectedCompanyType, setSelectedCompanyType] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [showAdditionalDetails, setShowAdditionalDetails] = useState<boolean>(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isValid, errors },
  } = useForm<OnboardingFormData>({
    mode: "onSubmit",
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      country: "",
      companyType: "",
      city: "",
      address1: "",
      address2: "",
      postalCode: "",
      registrationNumber: "",
    },
  });

  // Cleanup object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Redirect authenticated users away from onboarding
  useEffect(() => {
    if (!isAuthenticated) return;
    const hasCompany = !!(user as User)?.teamMembership?.companyId;
    const destination = hasCompany ? "/" : "/onboarding";

    router.push(destination);
  }, [isAuthenticated, user, router]);

  // Redirect unauthenticated users away from onboarding
  useEffect(() => {
    if (isAuthenticated) return;
    router.push("/login");
  }, [isAuthenticated, router]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPEG and PNG files are allowed");
      return;
    }

    // Validate file size (max 10MB for company logo)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Revoke old preview URL to prevent memory leaks (re-upload case)
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    // Show optimistic preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const result = await uploadLogoMutation.mutateAsync(file);
      setLogoUrl(result.url);
      toast.success("Logo uploaded successfully");
    } catch (error) {
      // Revert preview on failure
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
      setLogoUrl(null);
      toast.error("Failed to upload logo");
    }

    // Reset input so re-uploading the same file triggers onChange
    e.target.value = "";
  };

  const onSubmit = async (data: OnboardingFormData) => {
    if (step === "company") {
      try {
        await createCompanyMutation.mutateAsync({
          companyOwnerFirstName: data.firstName,
          companyOwnerLastName: data.lastName,
          companyName: data.companyName,
          registrationNumber: data.registrationNumber?.trim() || undefined,
          companyType: selectedCompanyType ? mapCompanyTypeToEnum(selectedCompanyType) : undefined,
          country: selectedCountry || undefined,
          address1: data.address1?.trim() || undefined,
          address2: data.address2?.trim() || undefined,
          city: data.city?.trim() || undefined,
          postalCode: data.postalCode?.trim() || undefined,
          logo: logoUrl || undefined,
        });
        toast.success("Company registered successfully");
        trackEvent(PostHogEvent.COMPANY_CREATED, { companyName: data.companyName });
        // Refresh the user data to get updated company info
        await refreshUser?.();
        setStep("complete");
      } catch (error: any) {
        const errorMessage = error?.userMessage || error?.message || "Failed to create company";
        toast.error(errorMessage);
      }
    } else if (step === "team") {
      // Team step logic can be added later
      setStep("complete");
    }
  };

  const renderStep = () => {
    switch (step) {
      case "company":
        return (
          <div className="flex flex-col gap-4 w-full animate-in fade-in duration-500">
            {/* Title */}
            <h1 className="text-[22px] md:text-[28px] font-medium text-text-primary tracking-tight">
              Tell us about your company
            </h1>

            {/* Company Logo Upload */}
            <div className="flex gap-4 items-start w-full">
              <label className="bg-[#ebf4ff] border border-primary-blue border-dashed rounded-full shrink-0 w-[86px] h-[86px] flex items-center justify-center relative overflow-hidden cursor-pointer hover:bg-blue-50 transition-colors">
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Company logo" className="w-full h-full object-cover" />
                    {uploadLogoMutation.isPending && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <img src="/misc/blue-upload-icon.svg" alt="Upload" className="w-6 h-6" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleLogoUpload}
                  disabled={uploadLogoMutation.isPending}
                  className="hidden"
                />
              </label>
              <div className="flex flex-col gap-2 flex-1 justify-center min-h-[86px]">
                <div className="flex flex-col gap-0.5">
                  <p className="font-barlow font-medium text-[16px] text-text-primary leading-[24px] tracking-[-0.32px]">
                    Company logo
                  </p>
                  <p className="font-barlow text-[14px] text-text-secondary leading-[20px] tracking-[-0.21px]">
                    Supported formats: JPEG, PNG
                  </p>
                </div>
                <label
                  className="border border-primary-divider rounded-lg px-3 py-1.5 w-fit font-barlow font-medium text-[14px] text-text-primary leading-[20px] tracking-[-0.56px] hover:bg-base-container-sub-background transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    pointerEvents: uploadLogoMutation.isPending ? "none" : "auto",
                    opacity: uploadLogoMutation.isPending ? 0.5 : 1,
                  }}
                >
                  {uploadLogoMutation.isPending ? "Uploading..." : previewUrl ? "Change photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleLogoUpload}
                    disabled={uploadLogoMutation.isPending}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <form className="flex flex-col gap-3 w-full" onSubmit={handleSubmit(onSubmit)}>
              {/* First and Last Name Row */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <div className="flex-1">
                  <InputOutlined
                    label="First name"
                    placeholder="Enter your first name"
                    size="compact"
                    error={!!errors.firstName}
                    errorMessage={errors.firstName ? "First name is required" : undefined}
                    {...register("firstName", { required: true })}
                  />
                </div>
                <div className="flex-1">
                  <InputOutlined
                    label="Last name"
                    placeholder="Enter your last name"
                    size="compact"
                    error={!!errors.lastName}
                    errorMessage={errors.lastName ? "Last name is required" : undefined}
                    {...register("lastName", { required: true })}
                  />
                </div>
              </div>

              {/* Company Name */}
              <InputOutlined
                label="Company name"
                placeholder="Enter your company name"
                size="compact"
                error={!!errors.companyName}
                errorMessage={errors.companyName ? "Company name is required" : undefined}
                {...register("companyName", { required: true })}
              />

              {/* Additional details toggle */}
              <div
                className="flex items-center gap-2 cursor-pointer py-1"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
              >
                <span className="text-text-secondary text-sm">Additional Details</span>
                <img
                  src="/arrow/chevron-down.svg"
                  alt="toggle"
                  className={`w-4 h-4 transition-transform ${showAdditionalDetails ? "rotate-180" : ""}`}
                />
              </div>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${showAdditionalDetails ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"} flex gap-3 flex-col`}
              >
                <CompanyTypeDropdown
                  selectedCompanyType={selectedCompanyType}
                  onCompanyTypeSelect={value => {
                    setSelectedCompanyType(value);
                    setValue("companyType", value);
                  }}
                  size="compact"
                />

                <CountryDropdown
                  selectedCountry={selectedCountry}
                  onCountrySelect={value => {
                    setSelectedCountry(value);
                    setValue("country", value);
                  }}
                  size="compact"
                />

                {/* City */}
                <InputOutlined label="City" placeholder="Enter city" size="compact" {...register("city")} />

                {/* Address 1 */}
                <InputOutlined
                  label="Address"
                  placeholder="Enter full address (min 5 characters)"
                  size="compact"
                  error={!!errors.address1}
                  errorMessage={
                    errors.address1?.type === "minLength" ? "Address must be at least 5 characters" : undefined
                  }
                  {...register("address1", {
                    minLength: {
                      value: 5,
                      message: "Address must be at least 5 characters",
                    },
                  })}
                />

                {/* Address 2 */}
                <InputOutlined
                  label="Address 2 (optional)"
                  placeholder="Enter address 2"
                  size="compact"
                  {...register("address2")}
                />

                {/* Postal Code and Registration Number Row */}
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <div className="w-full sm:w-36">
                    <InputOutlined
                      label="Postal code"
                      placeholder="e.g. 70000"
                      size="compact"
                      error={!!errors.postalCode}
                      errorMessage={
                        errors.postalCode?.type === "minLength" ? "Must be at least 3 characters" : undefined
                      }
                      {...register("postalCode", {
                        minLength: {
                          value: 3,
                          message: "Postal code must be at least 3 characters",
                        },
                      })}
                    />
                  </div>
                  <div className="flex-1">
                    <InputOutlined
                      label="Registration number"
                      placeholder="e.g. 8683949 (min 5 chars)"
                      size="compact"
                      error={!!errors.registrationNumber}
                      errorMessage={
                        errors.registrationNumber?.type === "minLength" ? "Must be at least 5 characters" : undefined
                      }
                      {...register("registrationNumber", {
                        minLength: {
                          value: 5,
                          message: "Registration number must be at least 5 characters",
                        },
                      })}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        );
      case "team":
        return (
          <div className="flex flex-col gap-4 md:gap-8 w-full animate-in fade-in duration-500">
            {/* Title */}
            <h1 className="text-[22px] md:text-[32px] font-medium text-text-primary tracking-tight">Add your Team</h1>
            {/* Form Fields */}
            <div className="flex flex-col gap-3 md:gap-4 w-full">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="flex flex-col sm:flex-row gap-2 w-full" key={index}>
                  <InputOutlined
                    label={`Member ${index + 1}`}
                    placeholder="Enter name"
                    size="compact"
                    {...register("firstName")}
                  />
                  <InputOutlined label="Email" placeholder="@mail" size="compact" {...register("lastName")} />
                </div>
              ))}
            </div>
            <span className="text-text-secondary text-[14px] md:text-[16px] max-w-[450px]">
              or you can upload a spreadsheet — our AI will automatically fill in your team details for you.
            </span>
            <FileUpload
              onFileSelect={files => {
                console.log("Files selected:", files);
                // Handle file upload logic here
              }}
            />
          </div>
        );
      case "complete":
        return (
          <div className="flex justify-center items-center flex-col h-full min-h-[400px] md:min-h-[530px] rounded-3xl border border-primary-divider relative overflow-hidden">
            <div
              className="absolute inset-0 w-full h-full z-0"
              style={{
                background: "url('/onboarding/complete-background.svg')",
                backgroundSize: "cover",
                filter: "blur(12px)",
              }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-4 text-center">
              <img
                src="/onboarding/hexagon-avatar.svg"
                alt="Onboarding Complete"
                className="w-[150px] h-[150px] md:w-[220px] md:h-[220px]"
              />
              <span className="font-bold text-xl md:text-2xl">Congratulations</span>
              <span className="text-base md:text-lg text-text-secondary">
                Your new account is ready to accept payments
              </span>
              <PrimaryButton
                text="Go to app"
                containerClassName="w-[180px] mt-6"
                onClick={() => {
                  router.push("/");
                }}
                icon="/arrow/chevron-right-light.svg"
                iconPosition="right"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-row w-full h-full p-3 md:p-5 bg-background overflow-hidden">
      <div className="flex flex-col items-start w-full lg:w-1/2 px-4 py-6 md:px-8 md:py-8 lg:p-[60px] h-full overflow-hidden">
        {/* Header with progress indicator */}
        <div className="flex gap-[19px] items-center w-full mb-4 md:mb-8 flex-shrink-0">
          <div className="flex gap-[4px] items-start flex-1">
            <div
              className={`h-1 rounded transition-all duration-500 ease-out ${
                step === "company" ? "w-7 bg-primary-blue" : "w-2.5 bg-[#D7D7D7]"
              }`}
            />
            <div
              className={`h-1 rounded transition-all duration-500 ease-out ${
                step === "team" ? "w-7 bg-primary-blue" : "w-2.5 bg-[#D7D7D7]"
              }`}
            />
            <div
              className={`h-1 rounded transition-all duration-500 ease-out ${
                step === "complete" ? "w-7 bg-primary-blue" : "w-2.5 bg-[#D7D7D7]"
              }`}
            />
          </div>
        </div>

        {/* Form content - scrollable */}
        <div className="w-full flex-1 overflow-y-auto min-h-0">{renderStep()}</div>

        {step !== "complete" && (
          <div
            className="w-full flex items-center pt-4 md:pt-5 flex-shrink-0"
            style={{
              justifyContent: step === "company" ? "flex-end" : "space-between",
            }}
          >
            {step === "team" && (
              <SecondaryButton
                text="Go Back"
                variant="light"
                buttonClassName="w-[100px]"
                onClick={() => setStep("company")}
              />
            )}
            <PrimaryButton
              text="Continue"
              containerClassName="w-[140px]"
              icon="/arrow/chevron-right-light.svg"
              iconPosition="right"
              onClick={handleSubmit(onSubmit)}
              loading={createCompanyMutation.isPending}
              disabled={!isValid || createCompanyMutation.isPending}
            />
          </div>
        )}
      </div>

      <div className="hidden lg:block lg:w-1/2">
        <Welcome />
      </div>
    </div>
  );
}
