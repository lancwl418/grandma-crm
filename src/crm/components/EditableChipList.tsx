import React, { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface Props {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /**
   * mode = "area" 使用中英文映射显示，如 Irvine（尔湾）
   * mode = "tag"  直接按原文显示
   */
  mode?: "area" | "tag";
}

const AREA_MAP: Record<string, string> = {
  irvine: "尔湾",
  tustin: "塔斯廷",
  "costa mesa": "科斯塔梅萨",
  anaheim: "安那罕",
  "laguna beach": "拉古纳海滩",
  "newport beach": "纽波特海滩",
  fullerton: "富乐顿",
  "lake forest": "拉克福里斯特",
  "mission viejo": "米慎维耶霍",
  "chino hills": "奇诺岗",
  walnut: "核桃市",
};

function formatAreaLabel(raw: string): string {
  // 已经是 “Irvine（尔湾）” 之类就直接用
  if (raw.includes("（") || raw.includes("(")) return raw;

  const key = raw.trim().toLowerCase();
  const zh = AREA_MAP[key];

  if (!zh) return raw;

  const enFormatted = raw
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");

  return `${enFormatted}（${zh}）`;
}

const EditableChipList: React.FC<Props> = ({
  values,
  onChange,
  placeholder,
  mode = "tag",
}) => {
  const [input, setInput] = useState("");

  const handleAdd = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 去重
    if (values.includes(trimmed)) {
      setInput("");
      return;
    }

    onChange([...values, trimmed]);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd(input);
    }
  };

  const displayLabel = (val: string) =>
    mode === "area" ? formatAreaLabel(val) : val;

  return (
    <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 min-h-[56px] flex flex-wrap gap-2">
      {values.map((val) => (
        <span
          key={val}
          className="inline-flex items-center rounded-2xl border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700"
        >
          {displayLabel(val)}
          <button
            type="button"
            className="ml-1 inline-flex items-center justify-center"
            onClick={() => onChange(values.filter((v) => v !== val))}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <input
        className="min-w-[80px] flex-1 bg-transparent text-sm text-slate-500 outline-none placeholder:text-slate-300"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => handleAdd(input)}
      />
    </div>
  );
};

export default EditableChipList;
