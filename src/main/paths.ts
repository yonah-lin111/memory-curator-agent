import { homedir } from "node:os";
import { join } from "node:path";

/**
 * 获取应用配置与数据根目录。
 */
export const getAppDataRoot = (): string => join(homedir(), ".mc");

/**
 * 获取 SQLite 数据库目录。
 */
export const getDatabaseDir = (): string => join(getAppDataRoot(), "db");

/**
 * 获取提示词历史目录。
 */
export const getPromptHistoryDir = (): string =>
  join(getAppDataRoot(), "history");

/**
 * 获取 SQLite 数据库文件路径。
 */
export const getDatabasePath = (): string =>
  join(getDatabaseDir(), "curator.db");

/**
 * 获取 Markdown 图片存储目录。
 */
export const getMarkdownImageDir = (): string =>
  join(getAppDataRoot(), "img", "md");

/**
 * 获取人物头像存储目录。
 */
export const getPeopleAvatarDir = (): string =>
  join(getAppDataRoot(), "img", "people");

/**
 * 获取个人头像存储目录。
 */
export const getPersonalAvatarDir = (): string =>
  join(getAppDataRoot(), "img", "profile");

/**
 * 获取 AI 聊天图片存储目录。
 */
export const getAiChatImageDir = (): string =>
  join(getAppDataRoot(), "img", "chat");

/**
 * 获取 Markdown 图片回收目录。
 */
export const getMarkdownImageTrashDir = (): string =>
  join(getAppDataRoot(), "trash", "img", "md");

/**
 * 获取 AI 聊天图片回收目录。
 */
export const getAiChatImageTrashDir = (): string =>
  join(getAppDataRoot(), "trash", "img", "chat");

/**
 * 获取 AI 聊天文本文件存储目录。
 */
export const getAiChatTextDir = (): string =>
  join(getAppDataRoot(), "text", "chat");

/**
 * 获取 AI 聊天文本文件回收目录。
 */
export const getAiChatTextTrashDir = (): string =>
  join(getAppDataRoot(), "trash", "text", "chat");

/**
 * 获取 Agent Skills 存储目录。
 */
export const getSkillsDir = (): string => join(getAppDataRoot(), "skills");

/**
 * 获取提示词设计 Agent 的用户自定义提示词路径。
 */
export const getPromptDesignAgentPromptPath = (): string =>
  join(getAppDataRoot(), "system prompt", "prompt-design-agent.xml");

/**
 * 获取记忆策展 Agent 的用户自定义提示词路径。
 */
export const getCuratorAgentPromptPath = (): string =>
  join(getAppDataRoot(), "system prompt", "curator-agent.xml");
