import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Edit3,
  Mic,
} from "lucide-react";

import AddClientForm from "./AddClientForm";
import { parsePastedClient } from "@/crm/utils/parsing";

export default function AddClientPopup({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  /** -----------------------
   * 1. 所有 Hook 必须写在最顶部
   ------------------------*/
  const [mode, setMode] = useState<"paste" | "image" | "manual" | "voice">(
    "paste"
  );
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  /** -----------------------
   * 2. 粘贴文本智能解析
   ------------------------*/
  const handleParseFromText = () => {
    const data = parsePastedClient(text);
    setParsedData(data);
  };

  /** -----------------------
   * 3. 图片上传智能解析
   ------------------------*/
  const handleImageUpload = async (file: File) => {
    setUploading(true);

    // 模拟 OCR：你后面再接真实 OCR API
    const data = {
      name: "识别出的名称",
      wechat: "wxid123",
      phone: "13800138000",
    };

    await new Promise((res) => setTimeout(res, 800));
    setParsedData(data);

    setUploading(false);
  };

  /** -----------------------
   * 4. paste 事件：用户直接 Ctrl+V 名片截图也支持
   ------------------------*/
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!open) return; // 必须检查弹窗是否打开

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleImageUpload(file);
        }
      }
    };

    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [open]);

  /** -----------------------
   * 5. drag & drop 事件（严格类型）
   ------------------------*/
  useEffect(() => {
    const dropEl = dropRef.current;
    if (!dropEl) return;

    const prevent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      handleImageUpload(files[0]);
    };

    const events: Array<keyof HTMLElementEventMap> = [
      "dragenter",
      "dragover",
      "dragleave",
      "drop",
    ];

    events.forEach((ev) => dropEl.addEventListener(ev, prevent as any));
    dropEl.addEventListener("drop", onDrop as any);

    return () => {
      events.forEach((ev) => dropEl.removeEventListener(ev, prevent as any));
      dropEl.removeEventListener("drop", onDrop as any);
    };
  }, []);

  /** -----------------------
   * 6. Hook 必须写在条件 return 前面！！
   ------------------------*/
  if (!open) return null;

  /** -----------------------
   * 7. 提交信息
   ------------------------*/
  const handleSubmit = () => {
    if (!parsedData) return;
    onSubmit(parsedData);
    onClose();
  };

  /** -----------------------
   * 8. UI 部分
   ------------------------*/
  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">录入新客户</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b pb-2">
          <button
            onClick={() => setMode("paste")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              mode === "paste" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            <Sparkles className="w-4 h-4" /> 智能粘贴
          </button>

          <button
            onClick={() => setMode("image")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              mode === "image" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            <ImageIcon className="w-4 h-4" /> 图片导入
          </button>

          <button
            onClick={() => setMode("manual")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              mode === "manual" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            <Edit3 className="w-4 h-4" /> 手动填写
          </button>

          <button
            onClick={() => setMode("voice")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              mode === "voice" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            <Mic className="w-4 h-4" /> 语音识别
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[200px]">
          {/* ---------- 智能粘贴 ---------- */}
          {mode === "paste" && (
            <div>
              <textarea
                placeholder="粘贴客户信息（微信名片/文字）"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-40 p-3 border rounded-lg"
              />
              <button
                className="mt-3 w-full bg-blue-600 text-white py-3 rounded-lg"
                onClick={handleParseFromText}
              >
                识别
              </button>
            </div>
          )}

          {/* ---------- 图片上传：点击 / 拖拽 / 粘贴 ---------- */}
          {mode === "image" && (
            <div
              ref={dropRef}
              className="border-2 border-dashed border-gray-300 p-10 rounded-lg text-center text-gray-500 cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <input
                type="file"
                ref={fileRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />

              {uploading ? (
                <div className="text-blue-600">解析中…</div>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">拖拽 / 点击上传名片截图</p>
                  <p className="text-sm">也支持 Ctrl + V 粘贴图片</p>
                </>
              )}
            </div>
          )}

          {/* ---------- 手动填写 ---------- */}
          {mode === "manual" && (
            <AddClientForm
              initialData={parsedData}
              onSubmit={(data) => {
                onSubmit(data);
                onClose();
              }}
            />
          )}

          {/* ---------- 语音输入 ---------- */}
          {mode === "voice" && (
            <div className="text-center text-gray-500 py-10">
              语音识别功能即将上线…
            </div>
          )}
        </div>

        {/* 保存按钮（针对 paste / image 模式） */}
        {parsedData && mode !== "manual" && (
          <button
            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg"
            onClick={handleSubmit}
          >
            保存客户
          </button>
        )}
      </div>
    </div>
  );
}
