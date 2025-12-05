import React, { useState } from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Filter,
  Plus,
} from "lucide-react";

import ClientCard from "./ClientCard";
import FilterSection from "./FilterSection";
import MobileFilterDrawer from "./MobileFilterDrawer";

import type { Client } from "@/crm/types";
import { CLIENT_STATUSES, URGENCY_LEVELS } from "@/crm/constants";

interface Props {
  clients: Client[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onAddNew: () => void;
  onSelectClient: (id: string) => void;

  availableTags: string[];
  availableAreas: string[];
}

const ClientList: React.FC<Props> = ({
  clients,
  searchTerm,
  setSearchTerm,
  onAddNew,
  onSelectClient,
  availableTags,
  availableAreas,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  // 选中项（用于真正筛选结果）
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedUrgencies, setSelectedUrgencies] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState({
    area: true,
    status: true,
    urgency: true,
    tag: true,
  });

  const toggleSelect = (
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  };

  // -------------------------------
  //  A. 用于 count 的 “排除自身条件的过滤”
  // -------------------------------
  const baseFilter = (skip?: "area" | "status" | "urgency" | "tag") =>
    clients.filter((c) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (c.name || "").toLowerCase().includes(term) ||
        (c.remarkName || "").toLowerCase().includes(term) ||
        (c.phone || "").includes(term) ||
        (c.wechat || "").toLowerCase().includes(term) ||
        (c.requirements?.areas || []).some((a) =>
          a.toLowerCase().includes(term)
        );

      const matchArea =
        skip === "area" ||
        selectedAreas.length === 0 ||
        (c.requirements?.areas || []).some((a) =>
          selectedAreas.includes(a)
        );

      const matchStatus =
        skip === "status" ||
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(c.status);

      const matchUrgency =
        skip === "urgency" ||
        selectedUrgencies.length === 0 ||
        selectedUrgencies.includes(c.urgency);

      const matchTags =
        skip === "tag" ||
        selectedTags.length === 0 ||
        (c.tags || []).some((t) => selectedTags.includes(t));

      return (
        matchSearch && matchArea && matchStatus && matchUrgency && matchTags
      );
    });

  // -------------------------------
  //  B. 动态计数（基于 baseFilter）
  // -------------------------------
  const areaCounts = (() => {
    const list = baseFilter("area");
    const map: Record<string, number> = {};
    list.forEach((c) =>
      (c.requirements?.areas || []).forEach((a) => {
        map[a] = (map[a] || 0) + 1;
      })
    );
    return map;
  })();

  const statusCounts = (() => {
    const list = baseFilter("status");
    const map: Record<string, number> = {};
    list.forEach((c) => {
      map[c.status] = (map[c.status] || 0) + 1;
    });
    return map;
  })();

  const urgencyCounts = (() => {
    const list = baseFilter("urgency");
    const map: Record<string, number> = {};
    list.forEach((c) => {
      map[c.urgency] = (map[c.urgency] || 0) + 1;
    });
    return map;
  })();

  const tagCounts = (() => {
    const list = baseFilter("tag");
    const map: Record<string, number> = {};
    list.forEach((c) =>
      (c.tags || []).forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      })
    );
    return map;
  })();

  // -------------------------------
  //  C. 最终过滤（用于展示）
  // -------------------------------
  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      (c.name || "").toLowerCase().includes(term) ||
      (c.remarkName || "").toLowerCase().includes(term) ||
      (c.phone || "").includes(term) ||
      (c.wechat || "").toLowerCase().includes(term) ||
      (c.requirements?.areas || []).some((a) =>
        a.toLowerCase().includes(term)
      );

    const matchArea =
      selectedAreas.length === 0 ||
      (c.requirements?.areas || []).some((a) =>
        selectedAreas.includes(a)
      );

    const matchStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(c.status);

    const matchUrgency =
      selectedUrgencies.length === 0 ||
      selectedUrgencies.includes(c.urgency);

    const matchTags =
      selectedTags.length === 0 ||
      (c.tags || []).some((t) => selectedTags.includes(t));

    return matchSearch && matchArea && matchStatus && matchUrgency && matchTags;
  });

  return (
    <div className="flex h-full gap-6">
      {/* 左侧 PC 筛选栏 */}
      <aside className="hidden md:block w-64 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-y-auto">
        <h2 className="font-bold text-gray-800 flex items-center mb-4">
          <Filter className="h-4 w-4 mr-2" /> 筛选条件
        </h2>

        {/* 区域 */}
        <FilterSection
          title="意向区域"
          isOpen={openSections.area}
          toggleOpen={() =>
            setOpenSections((prev) => ({ ...prev, area: !prev.area }))
          }
        >
          <div className="space-y-1">
            {availableAreas.map((area) => (
              <label
                key={area}
                className="flex items-center text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAreas.includes(area)}
                  onChange={() =>
                    toggleSelect(area, selectedAreas, setSelectedAreas)
                  }
                  className="mr-2"
                />
                <span className="flex-1">{area}</span>
                <span className="text-gray-400 text-xs">
                  ({areaCounts[area] || 0})
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* 跟进状态 */}
        <FilterSection
          title="跟进状态"
          isOpen={openSections.status}
          toggleOpen={() =>
            setOpenSections((prev) => ({ ...prev, status: !prev.status }))
          }
        >
          <div className="space-y-1">
            {CLIENT_STATUSES.map((s) => (
              <label
                key={s.label}
                className="flex items-center text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(s.label)}
                  onChange={() =>
                    toggleSelect(s.label, selectedStatuses, setSelectedStatuses)
                  }
                  className="mr-2"
                />
                <span className="flex-1">{s.label}</span>
                <span className="text-gray-400 text-xs">
                  ({statusCounts[s.label] || 0})
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* 紧急程度 */}
        <FilterSection
          title="紧急程度"
          isOpen={openSections.urgency}
          toggleOpen={() =>
            setOpenSections((prev) => ({ ...prev, urgency: !prev.urgency }))
          }
        >
          <div className="space-y-1">
            {Object.values(URGENCY_LEVELS).map((u) => (
              <label
                key={u.value}
                className="flex items-center text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedUrgencies.includes(u.value)}
                  onChange={() =>
                    toggleSelect(
                      u.value,
                      selectedUrgencies,
                      setSelectedUrgencies
                    )
                  }
                  className="mr-2"
                />
                <span className="flex-1">{u.label}</span>
                <span className="text-gray-400 text-xs">
                  ({urgencyCounts[u.value] || 0})
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* 标签 */}
        <FilterSection
          title="标签"
          isOpen={openSections.tag}
          toggleOpen={() =>
            setOpenSections((prev) => ({ ...prev, tag: !prev.tag }))
          }
        >
          <div className="space-y-1">
            {availableTags.map((tag) => (
              <label
                key={tag}
                className="flex items-center text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() =>
                    toggleSelect(tag, selectedTags, setSelectedTags)
                  }
                  className="mr-2"
                />
                <span className="flex-1">{tag}</span>
                <span className="text-gray-400 text-xs">
                  ({tagCounts[tag] || 0})
                </span>
              </label>
            ))}
          </div>
        </FilterSection>
      </aside>

      {/* 主体内容 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 搜索栏 / 操作区 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索名字、电话、区域..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                className="md:hidden bg-gray-100 px-3 py-2 rounded-lg flex items-center text-gray-700"
                onClick={() => setShowFilters(true)}
              >
                <Filter className="h-5 w-5 mr-1" /> 筛选
              </button>

              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition ${
                    viewMode === "grid"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition ${
                    viewMode === "list"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={onAddNew}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition"
              >
                <Plus className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">新增客户</span>
                <span className="sm:hidden">新增</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-2 text-sm text-gray-500">
          共找到 {filteredClients.length} 位客户
        </div>

        <div
          className={`flex-1 overflow-y-auto pr-1 pb-20 ${
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-3"
          }`}
        >
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => onSelectClient(client.id)}
            />
          ))}
        </div>
      </div>

      {/* Mobile 筛选抽屉 */}
      <MobileFilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
      >
        <div className="space-y-4">
          {/* 区域 */}
          <FilterSection
            title="意向区域"
            isOpen={openSections.area}
            toggleOpen={() =>
              setOpenSections((prev) => ({ ...prev, area: !prev.area }))
            }
          >
            <div className="space-y-1">
              {availableAreas.map((area) => (
                <label
                  key={area}
                  className="flex items-center text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAreas.includes(area)}
                    onChange={() =>
                      toggleSelect(area, selectedAreas, setSelectedAreas)
                    }
                    className="mr-2"
                  />
                  <span className="flex-1">{area}</span>
                  <span className="text-gray-400 text-xs">
                    ({areaCounts[area] || 0})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* 状态 */}
          <FilterSection
            title="跟进状态"
            isOpen={openSections.status}
            toggleOpen={() =>
              setOpenSections((prev) => ({ ...prev, status: !prev.status }))
            }
          >
            <div className="space-y-1">
              {CLIENT_STATUSES.map((s) => (
                <label
                  key={s.label}
                  className="flex items-center text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s.label)}
                    onChange={() =>
                      toggleSelect(
                        s.label,
                        selectedStatuses,
                        setSelectedStatuses
                      )
                    }
                    className="mr-2"
                  />
                  <span className="flex-1">{s.label}</span>
                  <span className="text-gray-400 text-xs">
                    ({statusCounts[s.label] || 0})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* 紧急程度 */}
          <FilterSection
            title="紧急程度"
            isOpen={openSections.urgency}
            toggleOpen={() =>
              setOpenSections((prev) => ({ ...prev, urgency: !prev.urgency }))
            }
          >
            <div className="space-y-1">
              {Object.values(URGENCY_LEVELS).map((u) => (
                <label
                  key={u.value}
                  className="flex items-center text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUrgencies.includes(u.value)}
                    onChange={() =>
                      toggleSelect(
                        u.value,
                        selectedUrgencies,
                        setSelectedUrgencies
                      )
                    }
                    className="mr-2"
                  />
                  <span className="flex-1">{u.label}</span>
                  <span className="text-gray-400 text-xs">
                    ({urgencyCounts[u.value] || 0})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* 标签 */}
          <FilterSection
            title="标签"
            isOpen={openSections.tag}
            toggleOpen={() =>
              setOpenSections((prev) => ({ ...prev, tag: !prev.tag }))
            }
          >
            <div className="space-y-1">
              {availableTags.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() =>
                      toggleSelect(tag, selectedTags, setSelectedTags)
                    }
                    className="mr-2"
                  />
                  <span className="flex-1">{tag}</span>
                  <span className="text-gray-400 text-xs">
                    ({tagCounts[tag] || 0})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>
        </div>

        <button
          onClick={() => setShowFilters(false)}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg text-center font-medium"
        >
          应用筛选
        </button>
      </MobileFilterDrawer>
    </div>
  );
};

export default ClientList;
