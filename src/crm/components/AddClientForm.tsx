// src/crm/components/AddClientForm.tsx
import React, { useState } from "react";
import SectionCard from "./SectionCard";
import { URGENCY_LEVELS, CLIENT_STATUSES } from "@/crm/constants";

export default function AddClientForm({
  initialData,
  onSubmit
}: {
  initialData?: any;
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState(
    initialData || {
      name: "",
      remarkName: "",
      phone: "",
      wechat: "",
      birthday: "",
      status: "新客户",
      urgency: "medium",
      requirements: {
        budgetMin: "",
        budgetMax: "",
        areas: [],
        tags: [],
      },
    }
  );

  const update = (patch: any) =>
    setForm({ ...form, ...patch });

  const updateReq = (patch: any) =>
    setForm({ ...form, requirements: { ...form.requirements, ...patch } });

  const addToList = (field: "areas" | "tags", value: string) => {
    if (!value.trim()) return;
    updateReq({ [field]: [...form.requirements[field], value.trim()] });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      {/* 基本信息 */}
      <SectionCard title="基本信息">
        <input
          className="w-full border rounded-lg p-2"
          placeholder="真实姓名"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <input
          className="w-full border rounded-lg p-2"
          placeholder="备注/小名"
          value={form.remarkName}
          onChange={(e) => update({ remarkName: e.target.value })}
        />

        <div className="flex gap-4 flex-wrap">
          <input
            className="flex-1 border rounded-lg p-2 min-w-[140px]"
            placeholder="手机号"
            value={form.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
          <input
            className="flex-1 border rounded-lg p-2 min-w-[140px]"
            placeholder="微信号"
            value={form.wechat}
            onChange={(e) => update({ wechat: e.target.value })}
          />
        </div>

        <input
          type="date"
          className="w-full border rounded-lg p-2"
          value={form.birthday}
          onChange={(e) => update({ birthday: e.target.value })}
        />
      </SectionCard>

      {/* 状态 & 紧急程度 */}
      <SectionCard title="客户状态">
        <select
          className="w-full border rounded-lg p-2"
          value={form.status}
          onChange={(e) => update({ status: e.target.value })}
        >
          {CLIENT_STATUSES.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className="w-full border rounded-lg p-2"
          value={form.urgency}
          onChange={(e) => update({ urgency: e.target.value })}
        >
          {Object.values(URGENCY_LEVELS).map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </SectionCard>

      {/* 需求 */}
      <SectionCard title="需求">
        <div className="flex gap-4 flex-wrap">
          <input
            className="flex-1 border rounded-lg p-2 min-w-[120px]"
            placeholder="预算下限（万）"
            value={form.requirements.budgetMin}
            onChange={(e) => updateReq({ budgetMin: e.target.value })}
          />
          <input
            className="flex-1 border rounded-lg p-2 min-w-[120px]"
            placeholder="预算上限（万）"
            value={form.requirements.budgetMax}
            onChange={(e) => updateReq({ budgetMax: e.target.value })}
          />
        </div>

        {/* 区域输入 */}
        <div>
          <div className="flex gap-2">
            <input
              id="area-input"
              className="flex-1 border rounded-lg p-2"
              placeholder="输入区域，如 Irvine"
            />
            <button
              type="button"
              className="px-3 bg-blue-600 text-white rounded-lg"
              onClick={() => {
                const input = document.getElementById("area-input") as HTMLInputElement;
                addToList("areas", input.value);
                input.value = "";
              }}
            >
              +
            </button>
          </div>

          {/* tag chips */}
          <div className="flex flex-wrap gap-2 mt-2">
            {form.requirements.areas.map((a: string) => (
              <span
                key={a}
                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full cursor-pointer"
                onClick={() =>
                  updateReq({
                    areas: form.requirements.areas.filter((x: string) => x !== a),
                  })
                }
              >
                {a} ✕
              </span>
            ))}
          </div>
        </div>

        {/* 标签 */}
        <div>
          <div className="flex gap-2">
            <input
              id="tag-input"
              className="flex-1 border rounded-lg p-2"
              placeholder="输入标签，如 急、仓库、投资"
            />
            <button
              type="button"
              className="px-3 bg-blue-600 text-white rounded-lg"
              onClick={() => {
                const input = document.getElementById("tag-input") as HTMLInputElement;
                addToList("tags", input.value);
                input.value = "";
              }}
            >
              +
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {form.requirements.tags.map((t: string) => (
              <span
                key={t}
                className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full cursor-pointer"
                onClick={() =>
                  updateReq({
                    tags: form.requirements.tags.filter((x: string) => x !== t),
                  })
                }
              >
                {t} ✕
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg"
      >
        保存客户
      </button>
    </form>
  );
}
