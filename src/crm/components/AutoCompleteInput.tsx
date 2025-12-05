import React, { useState } from "react";

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions: string[];
  placeholder: string;
}

export default function AutoCompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: Props) {
  const [input, setInput] = useState("");

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(input.toLowerCase())
  );

  const addItem = (item: string) => {
    if (!item.trim()) return;
    if (!value.includes(item)) {
      onChange([...value, item]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      {/* 已选标签 */}
      <div className="flex gap-2 flex-wrap">
        {value.map((v) => (
          <span
            key={v}
            className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full flex items-center gap-2"
          >
            {v}
            <button onClick={() => onChange(value.filter((x) => x !== v))}>
              ✕
            </button>
          </span>
        ))}
      </div>

      {/* 输入框 */}
      <input
        className="border p-2 w-full rounded-lg"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addItem(input);
          }
        }}
      />

      {/* 下拉建议 */}
      {input && (
        <div className="border rounded-lg bg-white shadow-md max-h-40 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((s) => (
              <div
                key={s}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => addItem(s)}
              >
                {s}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-400">无匹配项</div>
          )}
        </div>
      )}
    </div>
  );
}
