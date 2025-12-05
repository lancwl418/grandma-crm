import * as React from "react";
import { useState } from "react";

export type MultiSelectInputProps = {
  selectedItems: string[];
  availableItems: string[];
  onChange: (items: string[]) => void;
  onAddItem: (item: string) => void;
  placeholder?: string;
};

const MultiSelectInput: React.FC<MultiSelectInputProps> = ({
  selectedItems = [],
  availableItems = [],
  onChange,
  onAddItem,
  placeholder = ""
}) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);

  const addItem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!availableItems.includes(trimmed)) {
      onAddItem(trimmed);
    }
    if (!selectedItems.includes(trimmed)) {
      onChange([...selectedItems, trimmed]);
    }
    setInputValue("");
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem(inputValue);
    }
  };

  const removeItem = (value: string) => {
    onChange(selectedItems.filter((v) => v !== value));
  };

  const suggestions: string[] = availableItems.filter(
    (item) =>
      item.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedItems.includes(item)
  );

  return (
    <div className="relative">
      {/* 输入框 + 标签 */}
      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500">
        {selectedItems.map((item) => (
          <span
            key={item}
            className="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2 py-1 rounded-md flex items-center shadow-sm"
          >
            {item}
            <button
              type="button"
              onClick={() => removeItem(item)}
              className="ml-1 text-blue-400 hover:text-blue-900"
            >
              ×
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={selectedItems.length === 0 ? placeholder : ""}
          className="flex-1 outline-none text-sm min-w-[120px] bg-transparent"
        />
      </div>

      {/* 下拉建议 */}
      {isFocused && (suggestions.length > 0 || inputValue) && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">

          {/* 添加新项 */}
          {inputValue && !availableItems.includes(inputValue) && (
            <div
              className="px-3 py-2 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 flex items-center"
              onClick={() => addItem(inputValue)}
            >
              添加新项: "{inputValue}"
            </div>
          )}

          {/* 建议列表 */}
          {suggestions.map((item) => (
            <div
              key={item}
              onClick={() => addItem(item)}
              className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectInput;
