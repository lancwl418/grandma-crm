import React from "react";

const colors = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  gray: "bg-gray-100 text-gray-700 border-gray-300",
};

interface Props {
  label: string;
  color?: keyof typeof colors;
}

const TagBadge: React.FC<Props> = ({ label, color = "gray" }) => (
  <span
    className={`px-3 py-1 text-sm rounded-lg border ${colors[color]}`}
  >
    {label}
  </span>
);

export default TagBadge;
