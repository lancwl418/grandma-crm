import React, { useState } from "react";
import { Image as ImageIcon, Calendar as CalendarIcon } from "lucide-react";
import VoiceInputButton from "./VoiceInputButton";
import type { ClientLog } from "@/crm/types";
import { QUICK_LOG_TEMPLATES, NEXT_ACTION_OPTIONS } from "@/crm/constants";

interface Props {
  onAddLog: (log: ClientLog) => void;
}

const createLogId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const AddLogPanel: React.FC<Props> = ({ onAddLog }) => {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [nextDate, setNextDate] = useState("");
  const [nextActionContent, setNextActionContent] = useState("");

  // 图片上传（本地预览，用 base64 存在 log 里）
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // 允许连续选择同一张图
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!content.trim()) return;

    const log: ClientLog = {
      id: createLogId(),
      date: new Date().toISOString(),
      content: content.trim(),
      images: images.length ? images : undefined,
      nextAction:
        nextDate && nextActionContent.trim()
          ? `${nextDate}：${nextActionContent.trim()}`
          : undefined,
    };

    onAddLog(log);

    // 清空表单
    setContent("");
    setImages([]);
    setNextDate("");
    setNextActionContent("");
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">

      {/* 快捷跟进模板 */}
      <div className="flex flex-wrap gap-2">
        {QUICK_LOG_TEMPLATES.map((tpl) => (
          <button
            key={tpl.key}
            type="button"
            onClick={() => setContent(tpl.content)}
            className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs text-gray-700"
          >
            {tpl.label}
          </button>
        ))}
      </div>

      {/* 图片上传 + 预览 */}
      <div className="space-y-2">
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <ImageIcon size={18} />
          <span>上传图片</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((src, idx) => (
              <div key={idx} className="relative">
                <img
                  src={src}
                  alt={`log-img-${idx}`}
                  className="w-16 h-16 object-cover rounded-md border"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 文本内容 */}
      <textarea
        className="w-full h-28 border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="写点什么…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {/* 语音输入：把识别到的文本 append 到内容里 */}
      <VoiceInputButton
        onResult={(txt) => setContent((prev) => (prev ? `${prev}\n${txt}` : txt))}
      />

      {/* 下一步计划 */}
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <div className="flex items-center border rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50">
            <CalendarIcon size={16} className="mr-2 text-gray-400" />
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="bg-transparent outline-none"
            />
          </div>

          <input
            type="text"
            placeholder="下一步计划…（可选）"
            value={nextActionContent}
            onChange={(e) => setNextActionContent(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="button"
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            记录
          </button>
        </div>

        {/* 下一步计划预设选项 */}
        <div className="flex flex-wrap gap-2 text-xs">
          {NEXT_ACTION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setNextActionContent(opt.value)}
              className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <span className="mr-1">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddLogPanel;
