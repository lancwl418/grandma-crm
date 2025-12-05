import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Calendar,
  Pencil,
  X,
} from "lucide-react";

import LogItem from "./LogItem";
import AddLogPanel from "./AddLogPanel";

import type { Client, ClientLog } from "@/crm/types";

interface Props {
  client: Client;
  onBack: () => void;
  onUpdate: (updated: Client) => void;

  // 自动补全用到的全局标签 / 区域
  availableTags: string[];
  availableAreas: string[];
}

const ClientDetail: React.FC<Props> = ({
  client,
  onBack,
  onUpdate,
  availableTags,
  availableAreas,
}) => {
  if (!client) return null;

  // 备注编辑
  const [editingRemark, setEditingRemark] = useState(false);
  const [remarkDraft, setRemarkDraft] = useState(
    client.requirements?.notes || ""
  );

  // 标签 / 区域 输入框文本（用于自动补全）
  const [tagInput, setTagInput] = useState("");
  const [areaInput, setAreaInput] = useState("");

  const currentAreas = client.requirements?.areas || [];
  const currentTags = client.tags || [];

  // ⭐关键：同步 props，确保 UI 更新
useEffect(() => {
  setTagInput("");
  setAreaInput("");
}, [client]);

  // 更新 helper（保持 requirements merge）
  const update = (patch: Partial<Client>) => {
    onUpdate({
      ...client,
      ...patch,
      requirements: {
        ...client.requirements,
        ...(patch as any).requirements,
      },
    });
  };

  // 新增一条 log
  const handleAddLog = (log: ClientLog) => {
    update({
      logs: [...(client.logs || []), log],
    });
  };

  // 封装：添加区域
  const addArea = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (currentAreas.includes(v)) return;

    update({
      requirements: {
        areas: [...currentAreas, v],
      } as any,
    });
  };

  // 封装：添加标签
  const addTag = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (currentTags.includes(v)) return;

    update({
      tags: [...currentTags, v],
      requirements: {
        // 如果你希望 requirements.tags 也同步，可以取消注释：
        // tags: [...(client.requirements?.tags || []), v],
      } as any,
    });
  };

  // 自动补全：根据当前输入过滤
  const filteredAreaOptions =
    areaInput.trim() === ""
      ? []
      : availableAreas.filter(
          (a) =>
            a.toLowerCase().includes(areaInput.trim().toLowerCase()) &&
            !currentAreas.includes(a)
        );

  const filteredTagOptions =
    tagInput.trim() === ""
      ? []
      : availableTags.filter(
          (t) =>
            t.toLowerCase().includes(tagInput.trim().toLowerCase()) &&
            !currentTags.includes(t)
        );

  return (
    <div className="flex flex-col md:flex-row h-full gap-6 p-4 overflow-hidden">
      {/* ===== 左侧信息栏（手机在上方，PC 左侧） ===== */}
      <div className="w-full md:w-80 md:shrink-0 overflow-y-auto space-y-4">
        {/* 返回按钮（只在手机/小屏显示） */}
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-2 md:mb-0"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          返回
        </button>

        {/* 顶部：备注名（大号） + 真实姓名（小号） + 状态/紧急程度 */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              {/* 大号：remarkName（微信昵称 / 备注） */}
              <div className="text-3xl font-extrabold text-gray-900 leading-tight">
                {client.remarkName || "未命名客户"}
              </div>
              {/* 小号：真实姓名 */}
              {client.name && (
                <div className="mt-2 text-gray-500 text-lg">{client.name}</div>
              )}
            </div>

            {/* 右上角：状态 / 紧急程度 */}
            <div className="flex flex-col gap-2">
              <select
                value={client.status}
                onChange={(e) => update({ status: e.target.value })}
                className="border border-gray-300 rounded-2xl px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="新客户">新客户</option>
                <option value="看房中">看房中</option>
                <option value="意向强烈">意向强烈</option>
                <option value="已成交">已成交</option>
                <option value="暂缓/冷淡">暂缓/冷淡</option>
              </select>

              <select
                value={client.urgency}
                onChange={(e) =>
                  update({
                    urgency: e.target.value as "high" | "medium" | "low",
                  })
                }
                className="border border-gray-300 rounded-2xl px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          {/* 电话/微信/生日 */}
          <div className="space-y-3 mt-2">
            {/* 电话 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-800">
                <Phone className="h-4 w-4 text-gray-700" />
                <input
                  className="bg-transparent flex-1 outline-none text-base"
                  value={client.phone || ""}
                  onChange={(e) => update({ phone: e.target.value })}
                  placeholder="电话"
                />
              </div>
            </div>

            {/* 微信 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-800">
                <MessageSquare className="h-4 w-4 text-gray-700" />
                <input
                  className="bg-transparent flex-1 outline-none text-base"
                  value={client.wechat || ""}
                  onChange={(e) => update({ wechat: e.target.value })}
                  placeholder="微信"
                />
              </div>
            </div>

            {/* 生日 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-800">
                <Calendar className="h-4 w-4 text-pink-500" />
                <input
                  type="date"
                  className="bg-transparent flex-1 outline-none text-base"
                  value={client.birthday || ""}
                  onChange={(e) => update({ birthday: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 预算 */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
          <div className="font-semibold text-gray-900 mb-3">预算：</div>
          <div className="flex items-center gap-2">
            <input
              className="w-24 border border-gray-300 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={client.requirements?.budgetMin || ""}
              placeholder="最低（万）"
              onChange={(e) =>
                update({
                  requirements: {
                    budgetMin: e.target.value,
                  } as any,
                })
              }
            />
            <span className="text-gray-400">—</span>
            <input
              className="w-24 border border-gray-300 rounded-2xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={client.requirements?.budgetMax || ""}
              placeholder="最高（万）"
              onChange={(e) =>
                update({
                  requirements: {
                    budgetMax: e.target.value,
                  } as any,
                })
              }
            />
          </div>
        </div>

        {/* 区域（可编辑 + 自动补全） */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
          <div className="font-semibold text-gray-900 mb-3">区域：</div>
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {currentAreas.map((a) => (
                <div
                  key={a}
                  className="flex items-center bg-blue-50 px-3 py-1.5 rounded-full text-sm text-blue-700"
                >
                  {a}
                  <X
                    className="h-4 w-4 ml-2 cursor-pointer"
                    onClick={() =>
                      update({
                        requirements: {
                          areas: currentAreas.filter((x) => x !== a),
                        } as any,
                      })
                    }
                  />
                </div>
              ))}
            </div>

            {/* 输入 + 回车添加 + 自动补全列表 */}
            <input
              type="text"
              placeholder="输入区域，回车添加（如 Irvine）"
              className="w-full bg-white border border-dashed border-blue-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!areaInput.trim()) return;
                  addArea(areaInput);
                  setAreaInput("");
                }
              }}
            />

            {filteredAreaOptions.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto bg-white border border-blue-100 rounded-xl shadow-sm text-sm">
                {filteredAreaOptions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50"
                    onClick={() => {
                      addArea(a);
                      setAreaInput("");
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 标签（可编辑 + 自动补全） */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
          <div className="font-semibold text-gray-900 mb-3">标签：</div>
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {currentTags.map((t) => (
                <div
                  key={t}
                  className="flex items-center bg-blue-50 px-3 py-1.5 rounded-full text-sm text-blue-700"
                >
                  {t}
                  <X
                    className="h-4 w-4 ml-2 cursor-pointer"
                    onClick={() =>
                      update({
                        tags: currentTags.filter((x) => x !== t),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="输入标签，回车添加（如 学区房）"
              className="w-full bg-white border border-dashed border-blue-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!tagInput.trim()) return;
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
            />

            {filteredTagOptions.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto bg-white border border-blue-100 rounded-xl shadow-sm text-sm">
                {filteredTagOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50"
                    onClick={() => {
                      addTag(t);
                      setTagInput("");
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 备注（笔图标控制编辑） */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-gray-900">备注：</span>

            {!editingRemark && (
              <Pencil
                className="h-4 w-4 text-gray-500 cursor-pointer"
                onClick={() => setEditingRemark(true)}
              />
            )}
          </div>

          {editingRemark ? (
            <div className="space-y-3">
              <textarea
                className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm"
                rows={3}
                value={remarkDraft}
                onChange={(e) => setRemarkDraft(e.target.value)}
              />

              <button
                type="button"
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm"
                onClick={() => {
                  update({
                    requirements: { notes: remarkDraft } as any,
                  });
                  setEditingRemark(false);
                }}
              >
                保存
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-800 whitespace-pre-line">
              {client.requirements?.notes || "无备注"}
            </div>
          )}
        </div>
      </div>

      {/* ===== 右侧：跟进记录 + 新增 Log（手机在下方） ===== */}
      <div className="flex-1 overflow-y-auto bg-white rounded-[24px] border border-gray-100 shadow-sm p-4 flex flex-col">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <MessageSquare className="h-5 w-5 mr-2 text-gray-700" />
          跟进记录
        </h2>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {client.logs && client.logs.length > 0 ? (
            [...client.logs]
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              ) // 最新在上
              .map((log, index) => (
                <LogItem
                  key={log.id ?? index}
                  log={log}
                  index={index + 1}
                />
              ))
          ) : (
            <div className="text-sm text-gray-400">
              还没有跟进记录，下面写一条吧～
            </div>
          )}
        </div>

        {/* 新增 Log 面板 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <AddLogPanel onAddLog={handleAddLog} />
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;
