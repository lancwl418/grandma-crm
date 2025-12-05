import React from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobileFilterDrawer: React.FC<Props> = ({ open, onClose, children }) => {
  return (
    <div
      className={`fixed inset-0 z-50 md:hidden transition ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* 遮罩层 */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* 滑出面板 */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl 
          p-6 max-h-[80vh] overflow-y-auto transform transition-transform
          ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="h-1 w-10 bg-gray-300 rounded-full mx-auto mb-4"></div>

        {children}
      </div>
    </div>
  );
};

export default MobileFilterDrawer;
