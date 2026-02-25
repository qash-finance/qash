import React from "react";
import Image from "next/image";

export default function FullScreenLoading() {
  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="absolute left-0 top-0 h-4 w-full overflow-hidden">
        <div className="h-full w-1/3 animate-[progress_1.5s_ease-in-out_infinite] bg-[#066EFF]" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Image
          src="/logo/loading.gif"
          alt="Loading"
          width={450}
          height={450}
          priority
          unoptimized
        />
      </div>
      <style jsx>{`
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
      `}</style>
    </div>
  );
}
