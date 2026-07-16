import type React from "react";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Layers,
  LayoutGrid,
  Palette,
  Receipt,
  Settings,
  StickyNote,
  Users,
  User,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import type { SidebarPageId } from "../Sidebar";
import type { PersonalProfile } from "@/pages/personal-info/components/personalInfoShared";

// 主导航项类型，描述左侧应用级入口。
type NavigationItem = {
  // 导航项唯一标识。
  id: SidebarPageId;
  // 导航项显示名称。
  label: string;
  // 导航项辅助说明。
  description: string;
  // 导航项图标组件。
  icon: React.ComponentType<{ className?: string }>;
};

// 导航分组类型，描述产品使用节奏下的入口集合。
type NavigationGroup = {
  // 分组唯一标识。
  id: string;
  // 分组显示名称。
  label: string;
  // 分组下的导航项。
  items: NavigationItem[];
};

// 左侧主导航分组静态数据。
const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: "daily",
    label: "DAILY",
    items: [
      {
        id: "today",
        label: "Today",
        description: "计划 / 随记 / 日记",
        icon: Home,
      },
    ],
  },
  {
    id: "library",
    label: "LIBRARY",
    items: [
      {
        id: "notes",
        label: "Notes",
        description: "自由笔记列表",
        icon: FileText,
      },
      {
        id: "journal",
        label: "Journal",
        description: "日记条目回看",
        icon: BookOpen,
      },
      {
        id: "todo",
        label: "Todo",
        description: "待办清单",
        icon: CheckSquare,
      },
      {
        id: "snippets",
        label: "Snippets",
        description: "随手闪念随记",
        icon: StickyNote,
      },
      {
        id: "bills",
        label: "Bills",
        description: "账单收支记录",
        icon: Receipt,
      },
      {
        id: "people",
        label: "People",
        description: "人物关系档案",
        icon: Users,
      },
    ],
  },
  {
    id: "curation",
    label: "CURATION",
    items: [
      {
        id: "weekly",
        label: "Weekly Review",
        description: "周度策展",
        icon: CalendarDays,
      },
      {
        id: "themes",
        label: "Themes",
        description: "长期主题追踪",
        icon: Layers,
      },
      // {
      //   id: "memories",
      //   label: "Memories",
      //   description: "记忆片段关联",
      //   icon: Sparkles,
      // },
    ],
  },
  {
    id: "developer",
    label: "DEVELOPER",
    items: [
      {
        id: "showcase",
        label: "UI Showcase",
        description: "公共组件展示与交互",
        icon: LayoutGrid,
      },
      ...(import.meta.env.DEV
        ? [
            {
              id: "style-test" as SidebarPageId,
              label: "Style Test",
              description: "前端样式实验",
              icon: Palette,
            },
          ]
        : []),
    ],
  },
];

// SidebarNavigationList 组件属性类型。
type SidebarNavigationListProps = {
  // 是否折叠。
  isCollapsed: boolean;
  // 折叠状态改变回调。
  onCollapsedChange: (collapsed: boolean) => void;
  // 当前激活的页面标识。
  activePage: SidebarPageId;
  // 页面切换回调函数。
  onPageChange: (pageId: SidebarPageId) => void;
};

/**
 * SidebarNavigationList - 负责左侧主导航与应用内静态页面切换的纯列表渲染组件。
 */
export const SidebarNavigationList = ({
  isCollapsed,
  onCollapsedChange,
  activePage,
  onPageChange,
}: SidebarNavigationListProps): React.JSX.Element => {
  const shouldUseCollapsedLayout = isCollapsed;
  const [profile, setProfile] = useState<PersonalProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (window.api?.profile) {
          const data = await window.api.profile.get();
          setProfile(data as unknown as PersonalProfile);
        } else {
          const localData = localStorage.getItem("mc_personal_info");
          if (localData) setProfile(JSON.parse(localData));
        }
      } catch (err) {
        console.error("Failed to load profile for sidebar", err);
      }
    };
    fetchProfile();
    
    // 监听自定义的个人信息更新事件
    const handleProfileUpdate = () => {
      void fetchProfile();
    };

    window.addEventListener("mc:personal-info-updated", handleProfileUpdate);
    // 监听本地存储变化以在其他地方更新个人信息后能同步 ( fallback 用 )
    window.addEventListener("storage", fetchProfile);
    
    return () => {
      window.removeEventListener("mc:personal-info-updated", handleProfileUpdate);
      window.removeEventListener("storage", fetchProfile);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div
        className={`flex min-h-0 flex-1 flex-col gap-5 w-full ${
          shouldUseCollapsedLayout ? "" : "lg:w-[190px] lg:flex-shrink-0"
        }`}
      >
        {/* 用户头像与信息（替换了原来的产品标识头） */}
        <div
          className={`flex px-1 ${
            shouldUseCollapsedLayout
              ? "flex-col items-center gap-2"
              : "items-center justify-between gap-3"
          }`}
        >
          <Tooltip
            content={profile?.name || "My Profile"}
            placement="right"
            className={shouldUseCollapsedLayout ? "order-2" : "order-3"}
          >
            <button
              onClick={() => onPageChange("personal-info")}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                activePage === "personal-info"
                  ? "bg-white/20"
                  : "bg-white/5 hover:bg-white/10"
              }`}
              aria-label="My Profile"
            >
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-4.5 w-4.5 text-white/60" />
              )}
            </button>
          </Tooltip>
          <Tooltip
            key={shouldUseCollapsedLayout ? "collapsed" : "expanded"}
            content={shouldUseCollapsedLayout ? "展开" : "收起"}
            placement="right"
            className="order-1"
          >
            <IconButton
              aria-label={shouldUseCollapsedLayout ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => onCollapsedChange(!shouldUseCollapsedLayout)}
            >
              {shouldUseCollapsedLayout ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </IconButton>
          </Tooltip>
        </div>

        {/* 应用级主导航按使用节奏分组，避免入口平铺成普通工具列表。 */}
        <nav
          className="flex min-h-0 flex-1 flex-col gap-3 w-full overflow-y-auto scrollbar-hidden"
          aria-label="Sidebar main navigation"
        >
          {NAVIGATION_GROUPS.map((group, index) => (
            <section key={group.id} className="flex flex-col gap-1.5">
              {shouldUseCollapsedLayout && index > 0 && (
                <div className="border-t border-white/5 my-1 w-full" />
              )}
              {!shouldUseCollapsedLayout && (
                <h3 className="px-1 text-xs font-bold tracking-[0.18em] text-white/30 whitespace-nowrap">
                  {group.label}
                </h3>
              )}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === activePage;

                  const buttonContent = (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      aria-label={
                        shouldUseCollapsedLayout ? item.label : undefined
                      }
                      onClick={() => onPageChange(item.id)}
                      className={`flex w-full items-center rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                        shouldUseCollapsedLayout
                          ? "justify-center px-0 py-2.5"
                          : "gap-3 px-3 py-2.5"
                      } ${
                        isActive
                          ? "bg-white text-black font-semibold"
                          : "text-white/60 hover:bg-white/5 hover:text-white/85"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 flex-shrink-0 ${
                          isActive ? "text-black" : "text-white/50"
                        }`}
                      />
                      {!shouldUseCollapsedLayout && (
                        <div className="flex min-w-0 flex-col items-start text-left whitespace-nowrap">
                          <span className="text-sm font-bold leading-none whitespace-nowrap">
                            {item.label}
                          </span>
                          <span
                            className={`mt-1 text-xs leading-none whitespace-nowrap ${
                              isActive
                                ? "text-black/60 font-medium"
                                : "text-white/30"
                            }`}
                          >
                            {item.description}
                          </span>
                        </div>
                      )}
                    </button>
                  );

                  return shouldUseCollapsedLayout ? (
                    <Tooltip
                      key={item.id}
                      content={item.label}
                      placement="right"
                      className="w-full"
                    >
                      {buttonContent}
                    </Tooltip>
                  ) : (
                    buttonContent
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>

      {/* 底部设置 */}
      <div
        className={`mt-auto flex flex-col gap-2.5 pt-4 border-t border-white/5 w-full ${
          shouldUseCollapsedLayout ? "" : "lg:w-[160px] lg:flex-shrink-0"
        }`}
      >
        {shouldUseCollapsedLayout ? (
          <div className="flex flex-col gap-2 items-center">
            <Tooltip content="Settings" placement="right">
              <button
                type="button"
                aria-label="Settings"
                aria-current={activePage === "settings" ? "page" : undefined}
                onClick={() => onPageChange("settings")}
                className={`flex h-10 w-10 items-center justify-center rounded-[6px] border border-white/5 ${
                  activePage === "settings"
                    ? "bg-white text-black"
                    : "bg-white/[0.02] text-white/45 hover:bg-white/5 hover:text-white/85"
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            type="button"
            aria-current={activePage === "settings" ? "page" : undefined}
            onClick={() => onPageChange("settings")}
            className={`flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm whitespace-nowrap ${
              activePage === "settings"
                ? "bg-white text-black font-semibold"
                : "text-white/35 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Settings</span>
          </button>
        )}
      </div>
    </div>
  );
};
