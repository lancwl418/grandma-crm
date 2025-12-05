import React, { useState } from "react";
import ClientList from "@/crm/components/ClientList";
import ClientDetail from "@/crm/components/ClientDetail";
import AddClientPopup from "@/crm/components/AddClientPopup";

import type { Client } from "@/crm/types";
import { SAMPLE_CLIENTS, TAG_OPTIONS } from "@/crm/constants";

const RealEstateCRM: React.FC = () => {
  const [clients, setClients] = useState<Client[]>(SAMPLE_CLIENTS);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ⭐ 新增客户弹窗
  const [showAddPopup, setShowAddPopup] = useState(false);

  const selectedClient =
    clients.find((c) => c.id === selectedClientId) || null;

  // 动态区域列表（从所有客户里收集）
  const availableAreas = Array.from(
    new Set(clients.flatMap((c) => c.requirements?.areas || []))
  );

  // ⭐ 动态标签列表（从 clients + TAG_OPTIONS 合并）
  const availableTags = Array.from(
    new Set([
      ...clients.flatMap((c) => c.tags || []),
    ...clients.flatMap((c) => c.requirements?.tags || []),
    ])
  );

  // 更新单个客户（Detail 里的任何编辑都会走这里）
  const handleUpdateClient = (updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  // 新客户保存（兼容 data.tags 或 data.requirements.tags）
  const handleAddClient = (data: any) => {
    const mergedTags: string[] = Array.from(
      new Set([
        ...(data.tags || []),
        ...(data.requirements?.tags || []),
      ])
    );

    const newClient: Client = {
      id: Date.now().toString(),
      remarkName: data.remarkName || "",
      name: data.name || "",
      phone: data.phone || "",
      wechat: data.wechat || "",
      birthday: data.birthday || "",

      status: data.status || "新客户",
      urgency: data.urgency || "medium",

      tags: mergedTags,

      requirements: {
        budgetMin: data.requirements?.budgetMin || "",
        budgetMax: data.requirements?.budgetMax || "",
        notes: data.requirements?.notes || "",
        areas: data.requirements?.areas || [],
        tags: mergedTags,
      },

      logs: [],
    };

    setClients((prev) => [...prev, newClient]);
    setShowAddPopup(false);
  };

  return (
    <div className="h-full w-full bg-slate-50 p-4 md:p-6 overflow-hidden">
      {selectedClient ? (
        <ClientDetail
          client={
            // 确保传进去的是最新版本的 client
            clients.find((c) => c.id === selectedClient.id) || selectedClient
          }
          onBack={() => setSelectedClientId(null)}
          onUpdate={handleUpdateClient}
          availableTags={availableTags}
          availableAreas={availableAreas}
        />
      ) : (
        <>
          <ClientList
            clients={clients}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onAddNew={() => setShowAddPopup(true)}
            onSelectClient={(id) => setSelectedClientId(id)}
            availableTags={availableTags}
            availableAreas={availableAreas}
          />

          {/* 新增客户弹窗 */}
          <AddClientPopup
            open={showAddPopup}
            onClose={() => setShowAddPopup(false)}
            onSubmit={handleAddClient}
          />
        </>
      )}
    </div>
  );
};

export default RealEstateCRM;
