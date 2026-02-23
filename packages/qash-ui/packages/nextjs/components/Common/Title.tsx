import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MODAL_IDS } from "@/types/modal";
import { useModal } from "@/contexts/ModalManagerProvider";
import { useTitle } from "@/contexts/TitleProvider";
import { ActionButton } from "./ActionButton";
import { Tooltip } from "react-tooltip";
import { useAuth } from "@/services/auth/context";
import { TeamMemberRoleEnum } from "@qash/types/enums";
import { useGetNotificationsInfinite } from "@/services/api/notification";

export const Title = () => {
  const { openModal } = useModal();
  const pathname = usePathname();
  const router = useRouter();
  const { title, showBackArrow, onBackClick, resetTitle } = useTitle();
  const { user } = useAuth();

  // Reset title when route changes
  useEffect(() => {
    resetTitle();
  }, [pathname]);

  // Calculate unread count
  const { data } = useGetNotificationsInfinite();
  const unreadCount = data?.pages
    ? data.pages.flatMap(page => page.notifications).filter((item: any) => item.status === "UNREAD").length
    : 0;

  return (
    <div className="flex flex-row gap-2 mx-[24px] pt-1">
      <div className="w-[100%] px-1 py-2 justify-center items-center flex gap-3">
        {showBackArrow && (
          <img src="/arrow/thin-arrow-left.svg" alt="back" className="w-5 cursor-pointer" onClick={onBackClick} />
        )}
        <div className="leading-none text-text-secondary text-lg flex-1">{title}</div>
      </div>

      {/* <button
        className="cursor-pointer flex flex-row gap-1 items-center justify-center px-6 py-2 bg-background rounded-lg leading-none border-t-1 border-t-primary-divider"
        onClick={() => router.push("/batch")}
      >
        <img src="/misc/dark-shopping-bag.svg" alt="coin-icon" className="w-5 h-5 " />
        Batch
      </button> */}

      {user && user.teamMembership?.role === TeamMemberRoleEnum.VIEWER && (
        <>
          <div
            className="flex flex-row justify-center items-center rounded-full px-4 bg-[#F7E3DA] gap-1"
            data-tooltip-id="user-role-tooltip"
          >
            <img src="/misc/orange-eye-icon.svg" alt="divider" className="w-6" />
            <span className="text-[#E97135]">Viewer</span>
          </div>

          {/* Batch Action Tooltip */}
          <Tooltip
            id="user-role-tooltip"
            style={{
              zIndex: 20,
              borderRadius: "16px",
              padding: "0",
            }}
            arrowColor="#444444"
            place="bottom"
            border="none"
            opacity={1}
            render={({ content }) => {
              return <div className="bg-[#444444] px-4 py-2 rounded-xl">Viewer can only view in this team.</div>;
            }}
          />
        </>
      )}

      {user && user.teamMembership?.role === TeamMemberRoleEnum.REVIEWER && (
        <>
          <div
            className="flex flex-row justify-center items-center rounded-full px-6 bg-[#CBE5F8] gap-1"
            data-tooltip-id="user-role-tooltip"
          >
            <img src="/misc/blue-note-icon.svg" alt="divider" className="w-6" />
            <span className="text-[#1E8FFF]">Reviewer</span>
          </div>

          {/* Batch Action Tooltip */}
          <Tooltip
            id="user-role-tooltip"
            style={{
              zIndex: 20,
              borderRadius: "16px",
              padding: "0",
            }}
            arrowColor="#444444"
            place="bottom"
            border="none"
            opacity={1}
            render={({ content }) => {
              return <div className="bg-[#444444] px-4 py-2 rounded-xl">Reviewer can only vote proposal</div>;
            }}
          />
        </>
      )}

      <button
        className="cursor-pointer flex flex-row gap-1 items-center justify-center px-6 py-2 bg-background rounded-lg leading-none"
        onClick={() => openModal(MODAL_IDS.PORTFOLIO)}
      >
        <img src="/misc/two-star-icon.svg" alt="coin-icon" className="w-5 h-5 " />
        Portfolio
      </button>

      <div
        className="relative flex flex-row gap-2 justify-center items-center w-12 bg-[#292929] rounded-lg cursor-pointer"
        onClick={() => openModal(MODAL_IDS.NOTIFICATION)}
      >
        <img src="/notification/notification.gif" alt="bell" className="w-5 h-5" />
        {unreadCount > 0 && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#FF2323] rounded-full" />}
      </div>
    </div>
  );
};
