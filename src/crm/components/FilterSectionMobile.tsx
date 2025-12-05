import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  isOpen: boolean;
  toggleOpen: () => void;
  children: React.ReactNode;
}

const FilterSectionMobile: React.FC<Props> = ({
  title,
  isOpen,
  toggleOpen,
  children,
}) => {
  return (
    <div className="border-b border-gray-200 pb-3">
      <button
        className="w-full flex items-center justify-between text-gray-900 font-semibold text-base py-2"
        onClick={toggleOpen}
      >
        {title}
        {isOpen ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </button>

      {isOpen && <div className="pl-1 py-1 text-gray-700">{children}</div>}
    </div>
  );
};

export default FilterSectionMobile;
