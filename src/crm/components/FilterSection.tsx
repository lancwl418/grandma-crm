import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  isOpen: boolean;
  toggleOpen: () => void;
  children: React.ReactNode;
}

const FilterSection: React.FC<Props> = ({
  title,
  isOpen,
  toggleOpen,
  children,
}) => {
  return (
    <div className="border-b border-gray-100 pb-3 mb-3">
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between text-gray-800 font-medium mb-2"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {isOpen && <div className="pl-1">{children}</div>}
    </div>
  );
};

export default FilterSection;
