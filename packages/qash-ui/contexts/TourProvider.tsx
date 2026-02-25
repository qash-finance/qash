"use client";

import { ReactNode, useState, useEffect } from "react";
import { StepType, TourProvider, useTour } from "@reactour/tour";
import { usePathname } from "next/navigation";
import { ActionButton } from "@/components/Common/ActionButton";
import { TOUR_SKIPPED_KEY } from "@/services/utils/constant";

type ArrowDirection = "up" | "down" | "left" | "right";

// Shared popover styles matching the app's design system
const sharedPopoverStyles = {
  backgroundColor: "var(--background)",
  borderRadius: "16px",
  border: "1px solid var(--primary-divider)",
  boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.08), 0px 0px 0px 1px var(--primary-divider)",
  color: "var(--text-primary)",
  maxWidth: "380px",
  padding: "16px",
};

const Pagination = ({
  currentStep,
  totalSteps,
  className = "",
}: {
  currentStep: number;
  totalSteps: number;
  className?: string;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const isActive = index === currentStep;
        const isPast = index < currentStep;

        return (
          <div
            key={index}
            className={`
                transition-all duration-500 ease-in-out
                ${
                  isActive
                    ? "bg-[--primary-blue] w-4 h-2 rounded-full"
                    : isPast
                      ? "bg-[--primary-divider] w-2 h-2 rounded-full"
                      : "bg-[--primary-divider] w-2 h-2 rounded-full"
                }
              `}
          />
        );
      })}
    </div>
  );
};

// Component that provides tour controls to step content
const TourStepContent = ({ text, arrowDirection }: { text: string; arrowDirection?: ArrowDirection }) => {
  const { setIsOpen, setCurrentStep, currentStep } = useTour();

  const handleSkip = () => {
    localStorage.setItem(TOUR_SKIPPED_KEY, "true");
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      localStorage.setItem(TOUR_SKIPPED_KEY, "true");
      setIsOpen(false);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const getArrowSrc = (direction?: ArrowDirection) => {
    switch (direction) {
      case "up":
        return "/tooltip/tooltip-up-arrow.svg";
      case "down":
        return "/tooltip/tooltip-down-arrow.svg";
      case "left":
        return "/tooltip/tooltip-left-arrow.svg";
      case "right":
        return "/tooltip/tooltip-right-arrow.svg";
      default:
        return null;
    }
  };

  const arrowSrc = getArrowSrc(arrowDirection);

  return (
    <div className="flex flex-col gap-2">
      <img src="/tooltip-lightbulb.svg" alt="lightbulb" className="w-6 h-6" />
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {text}
      </div>
      <div className="flex flex-row gap-3">
        <Pagination currentStep={currentStep} totalSteps={steps.length} className="justify-center" />
        <div className="flex flex-row gap-2 justify-end">
          <ActionButton text="Skip" type="neutral" onClick={handleSkip} className="w-[100px] flex-1" />
          <ActionButton text="Next" type="accept" onClick={handleNext} className="w-[100px] flex-1" />
        </div>
      </div>
      {arrowSrc && (
        <img
          src={arrowSrc}
          alt={`arrow-${arrowDirection}`}
          className="absolute"
          style={{
            position: "absolute",
            ...(arrowDirection === "up" && { top: "-10px", left: "50%", transform: "translateX(-50%)" }),
            ...(arrowDirection === "down" && { bottom: "-10px", left: "50%", transform: "translateX(-50%)" }),
            ...(arrowDirection === "left" && { left: "-10px", top: "50%", transform: "translateY(-50%)" }),
            ...(arrowDirection === "right" && { right: "-10px", top: "50%", transform: "translateY(-50%)" }),
          }}
        />
      )}
    </div>
  );
};

const steps: StepType[] = [
  // Step 0 - Sidebar navigation
  {
    selector: ".sidebar",
    content: (
      <TourStepContent
        text="Welcome to Qash! This is your sidebar, use it to quickly navigate between Dashboard, Payroll, Invoices, Bills, and more."
        arrowDirection="left"
      />
    ),
  },
  // Step 1 - Total balances & upcoming payroll cards
  {
    selector: "#tour-cards",
    content: (
      <TourStepContent
        text="Here you can see your total treasury balance across all accounts and your upcoming payroll summary at a glance."
        arrowDirection="up"
      />
    ),
    styles: {
      popover: base => ({
        ...base,
        ...sharedPopoverStyles,
        top: Number(base.top) + 10,
      }),
    },
  },
  // Step 2 - Balance overview chart
  {
    selector: "#tour-balance-overview",
    content: (
      <TourStepContent
        text="This chart tracks your balance over time. Monitor monthly inflows, outflows, and how your holdings change across assets."
        arrowDirection="up"
      />
    ),
    styles: {
      popover: base => ({
        ...base,
        ...sharedPopoverStyles,
        top: Number(base.top) + 10,
      }),
    },
  },
  // Step 3 - Money in & out (transaction history)
  {
    selector: "#tour-money-in-out",
    content: (
      <TourStepContent
        text="Here are your recent transactions, every payment sent and received is listed so you always know where your money is going."
        arrowDirection="down"
      />
    ),
    position: "top",
    styles: {
      popover: base => ({
        ...base,
        ...sharedPopoverStyles,
        top: Number(base.top) - 10,
      }),
    },
  },
  // Step 4 - Multisig accounts
  {
    selector: "#tour-multisig",
    content: (
      <TourStepContent
        text="This is where you manage your multisig accounts. Create an account, add teammates as signers, and start running your company operations."
        arrowDirection="down"
      />
    ),
    position: "top",
    styles: {
      popover: base => ({
        ...base,
        ...sharedPopoverStyles,
        top: Number(base.top) - 10,
      }),
    },
  },
];

// Auto-starts the tour once for first-time users on the home page
const AutoStartTour = () => {
  const { setIsOpen, setCurrentStep } = useTour();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const alreadySeen = localStorage.getItem(TOUR_SKIPPED_KEY);
    if (alreadySeen) return;

    // Small delay so the DOM elements targeted by the tour are rendered
    const timer = setTimeout(() => {
      setCurrentStep(0);
      setIsOpen(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [pathname, setIsOpen, setCurrentStep]);

  return null;
};

interface TourProviderWrapperProps {
  children: ReactNode;
}

export const TourProviderWrapper = ({ children }: TourProviderWrapperProps) => {
  return (
    <TourProvider
      showNavigation={false}
      showBadge={false}
      showCloseButton={false}
      disableDotsNavigation={true}
      showDots={false}
      steps={steps}
      padding={{
        popover: [5],
      }}
      onClickMask={({ setIsOpen }) => {
        localStorage.setItem(TOUR_SKIPPED_KEY, "true");
        setIsOpen(false);
      }}
      onClickClose={({ setIsOpen }) => {
        localStorage.setItem(TOUR_SKIPPED_KEY, "true");
        setIsOpen(false);
      }}
      styles={{
        popover: base => ({
          ...base,
          "--reactour-accent": "var(--primary-blue)",
          ...sharedPopoverStyles,
        }),
        maskArea: base => ({ ...base, rx: 16 }),
      }}
    >
      <AutoStartTour />
      {children}
    </TourProvider>
  );
};
