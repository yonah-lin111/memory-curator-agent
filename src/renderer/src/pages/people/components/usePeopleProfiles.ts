import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  createDisplayTime,
  createInitialFormState,
  createPersonPayload,
  INITIAL_FORM_STATE,
  LOCAL_STORAGE_KEY,
  readPeopleSeed,
  type FormState,
  type PeoplePageMode,
  type PersonProfile,
  type RelationshipFilter,
} from "@/pages/people/components/peopleShared";

// 标签统计项。
type TagStat = {
  // 标签名。
  name: string;
  // 使用次数。
  count: number;
};

// 人物页面数据状态。
export type PeopleProfilesState = {
  // 人物列表数据。
  people: PersonProfile[];
  // 当前选中的人物 ID。
  selectedId: string | null;
  // 设置当前选中的人物 ID。
  setSelectedId: (id: string | null) => void;
  // 搜索关键字。
  searchQuery: string;
  // 设置搜索关键字。
  setSearchQuery: (query: string) => void;
  // 当前选中的关系过滤器。
  relationFilter: RelationshipFilter;
  // 设置关系过滤器。
  setRelationFilter: (filter: RelationshipFilter) => void;
  // 当前选中的标签过滤器。
  selectedTag: string | null;
  // 设置标签过滤器。
  setSelectedTag: (tag: string | null) => void;
  // 页面模式。
  mode: PeoplePageMode;
  // 设置页面模式。
  setMode: (mode: PeoplePageMode) => void;
  // 编辑或创建表单数据。
  formState: FormState;
  // 设置表单数据。
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  // 当前选中的人物档案。
  currentPerson: PersonProfile | null;
  // 标签统计数据。
  tagStats: TagStat[];
  // 过滤后的人物列表。
  filteredPeople: PersonProfile[];
  // 进入编辑模式。
  enterEditMode: () => void;
  // 进入新建模式。
  enterCreateMode: () => void;
  // 保存表单。
  handleSaveForm: () => Promise<void>;
  // 删除人物。
  handleDeletePerson: (id: string, name: string) => Promise<void>;
};

/**
 * 使用 People 页面人物档案数据。
 */
export const usePeopleProfiles = (): PeopleProfilesState => {
  // 人物列表数据。
  const [people, setPeople] = useState<PersonProfile[]>([]);
  // 当前选中的人物 ID。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 搜索关键字。
  const [searchQuery, setSearchQuery] = useState("");
  // 当前选中的关系过滤器。
  const [relationFilter, setRelationFilter] =
    useState<RelationshipFilter>("全部");
  // 当前选中的标签过滤器。
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // 页面模式。
  const [mode, setMode] = useState<PeoplePageMode>("view");
  // 编辑或创建表单数据。
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  // 消息提示实例。
  const toast = useToast();

  /**
   * 初始化：优先从 SQLite 读取数据，空库时只初始化 tolin。
   */
  useEffect(() => {
    const loadPeople = async (): Promise<void> => {
      const peopleApi = window.api?.people;
      if (peopleApi) {
        try {
          const storedPeople = await peopleApi.list();

          if (storedPeople.length > 0) {
            setPeople(storedPeople);
            setSelectedId(storedPeople[0].id);
            return;
          }

          const seed = readPeopleSeed();
          const createdPeople = await Promise.all(
            seed.map((person) => peopleApi.create(createPersonPayload(person))),
          );

          setPeople(createdPeople);
          setSelectedId(createdPeople[0]?.id ?? null);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(createdPeople));
          return;
        } catch (err) {
          console.error("读取 SQLite 人物档案失败，降级使用 LocalStorage", err);
        }
      }

      const seed = readPeopleSeed();
      setPeople(seed);
      setSelectedId(seed[0]?.id ?? null);
    };

    void loadPeople();
  }, []);

  // 当前选中的人档案。
  const currentPerson = useMemo(() => {
    return people.find((person) => person.id === selectedId) || null;
  }, [people, selectedId]);

  // 所有标签及其对应频数。
  const tagStats = useMemo(() => {
    const stats = new Map<string, number>();
    people.forEach((person) => {
      person.tags.forEach((tag) => {
        const cleaned = tag.trim();
        if (cleaned) {
          stats.set(cleaned, (stats.get(cleaned) || 0) + 1);
        }
      });
    });
    return Array.from(stats.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [people]);

  // 过滤后的人物列表。
  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      if (relationFilter !== "全部" && person.relationship !== relationFilter) {
        return false;
      }

      if (selectedTag && !person.tags.includes(selectedTag)) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = person.name.toLowerCase().includes(query);
        const matchesStatus = person.status.toLowerCase().includes(query);
        const matchesContact = person.contact.toLowerCase().includes(query);
        const matchesTags = person.tags.some((tag) =>
          tag.toLowerCase().includes(query),
        );
        return matchesName || matchesStatus || matchesContact || matchesTags;
      }

      return true;
    });
  }, [people, relationFilter, searchQuery, selectedTag]);

  /**
   * 保存 LocalStorage 降级缓存。
   */
  const cachePeopleFallback = (nextPeople: PersonProfile[]): void => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextPeople));
  };

  /**
   * 创建本地降级人物档案。
   */
  const createFallbackPerson = (): PersonProfile => {
    const formattedTime = createDisplayTime();
    return {
      id: Math.random().toString(36).substring(2, 9),
      ...createPersonPayload(formState),
      createdAt: formattedTime,
      updatedAt: formattedTime,
    };
  };

  /**
   * 创建本地降级更新档案。
   */
  const createFallbackUpdatedPerson = (person: PersonProfile): PersonProfile => ({
    ...person,
    ...createPersonPayload(formState),
    updatedAt: createDisplayTime(),
  });

  /**
   * 触发进入编辑模式。
   */
  const enterEditMode = (): void => {
    if (!currentPerson) {
      return;
    }

    setFormState({
      name: currentPerson.name,
      gender: currentPerson.gender,
      relationship: currentPerson.relationship,
      status: currentPerson.status,
      birthday: currentPerson.birthday,
      contact: currentPerson.contact,
      tags: [...currentPerson.tags],
      details: currentPerson.details,
      avatar: currentPerson.avatar,
    });
    setMode("edit");
  };

  /**
   * 触发进入新建模式。
   */
  const enterCreateMode = (): void => {
    setFormState(createInitialFormState());
    setMode("create");
  };

  /**
   * 保存当前表单。
   */
  const handleSaveForm = async (): Promise<void> => {
    if (!formState.name.trim()) {
      toast.error("姓名不能为空");
      return;
    }

    const payload = createPersonPayload(formState);

    if (mode === "create") {
      try {
        const newPerson = window.api?.people
          ? await window.api.people.create(payload)
          : createFallbackPerson();
        const updatedPeople = [newPerson, ...people];
        setPeople(updatedPeople);
        cachePeopleFallback(updatedPeople);
        setSelectedId(newPerson.id);
        toast.success(`成功创建 ${newPerson.name} 的人物档案`);
      } catch {
        toast.error("创建人物档案失败");
        return;
      }
    } else if (mode === "edit" && currentPerson) {
      try {
        const updatedPerson = window.api?.people
          ? await window.api.people.update(currentPerson.id, payload)
          : createFallbackUpdatedPerson(currentPerson);
        const updatedPeople = people.map((person) =>
          person.id === currentPerson.id ? updatedPerson : person,
        );
        setPeople(updatedPeople);
        cachePeopleFallback(updatedPeople);
        toast.success("档案保存成功");
      } catch {
        toast.error("保存人物档案失败");
        return;
      }
    }

    setMode("view");
  };

  /**
   * 删除当前档案。
   */
  const handleDeletePerson = async (id: string, name: string): Promise<void> => {
    if (!window.confirm(`确定要彻底删除 ${name} 的人物档案吗？此操作不可逆。`)) {
      return;
    }

    try {
      if (window.api?.people) {
        await window.api.people.delete(id);
      }
    } catch {
      toast.error("删除人物档案失败");
      return;
    }

    const updated = people.filter((person) => person.id !== id);
    setPeople(updated);
    cachePeopleFallback(updated);
    toast.success(`${name} 的档案已删除`);

    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
  };

  return {
    people,
    selectedId,
    setSelectedId,
    searchQuery,
    setSearchQuery,
    relationFilter,
    setRelationFilter,
    selectedTag,
    setSelectedTag,
    mode,
    setMode,
    formState,
    setFormState,
    currentPerson,
    tagStats,
    filteredPeople,
    enterEditMode,
    enterCreateMode,
    handleSaveForm,
    handleDeletePerson,
  };
};
