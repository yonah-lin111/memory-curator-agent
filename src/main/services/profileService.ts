import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { getDatabase } from "@/db"
import {
  type PersonalProfileItem,
  type PersonalProfileUpdateInput,
  personalProfiles,
} from "@/db/schema"

const PROFILE_ID = 1

/**
 * 转换数据库行到前端可用格式
 */
const mapRowToItem = (row: any): PersonalProfileItem => ({
  id: row.id,
  avatar: row.avatar,
  name: row.name,
  gender: row.gender,
  status: row.status,
  birthday: row.birthday,
  contact: row.contact,
  tags: JSON.parse(row.tags) as string[],
  details: row.details,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

/**
 * 清空个人信息。
 */
export const clearProfile = (): void => {
  const db = drizzle(getDatabase())
  db.delete(personalProfiles).where(eq(personalProfiles.id, PROFILE_ID)).run()
}

/**
 * 获取个人信息。如果不存在则返回 null。
 */
export const getProfile = (): PersonalProfileItem | null => {
  const db = drizzle(getDatabase())

  const rows = db.select().from(personalProfiles).where(eq(personalProfiles.id, PROFILE_ID)).all()
  if (rows.length === 0) {
    return null
  }

  return mapRowToItem(rows[0])
}

/**
 * 创建个人信息档案。
 */
export const createProfile = (payload: PersonalProfileUpdateInput): PersonalProfileItem => {
  if (getProfile()) {
    throw new Error("个人信息档案已存在")
  }

  return updateProfile(payload)
}

/**
 * 按字段更新个人信息；档案不存在时创建。
 */
export const updateProfilePartial = (
  payload: Partial<PersonalProfileUpdateInput>,
): PersonalProfileItem => {
  const existing = getProfile()
  const profile: PersonalProfileUpdateInput = {
    avatar: payload.avatar ?? existing?.avatar ?? "",
    name: payload.name ?? existing?.name ?? "",
    gender: payload.gender ?? existing?.gender ?? "",
    status: payload.status ?? existing?.status ?? "",
    birthday: payload.birthday ?? existing?.birthday ?? "",
    contact: payload.contact ?? existing?.contact ?? "",
    tags: payload.tags ?? existing?.tags ?? [],
    details: payload.details ?? existing?.details ?? "",
  }

  if (!profile.name.trim()) {
    throw new Error("个人信息档案需要姓名")
  }

  return updateProfile(profile)
}

/**
 * 更新或创建个人信息。
 */
export const updateProfile = (payload: PersonalProfileUpdateInput): PersonalProfileItem => {
  const db = drizzle(getDatabase())
  const now = new Date().toISOString()

  const existing = getProfile()

  if (!existing) {
    db.insert(personalProfiles)
      .values({
        id: PROFILE_ID,
        avatar: payload.avatar,
        name: payload.name,
        gender: payload.gender,
        status: payload.status,
        birthday: payload.birthday,
        contact: payload.contact,
        tags: JSON.stringify(payload.tags),
        details: payload.details,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  } else {
    db.update(personalProfiles)
      .set({
        avatar: payload.avatar,
        name: payload.name,
        gender: payload.gender,
        status: payload.status,
        birthday: payload.birthday,
        contact: payload.contact,
        tags: JSON.stringify(payload.tags),
        details: payload.details,
        updatedAt: now,
      })
      .where(eq(personalProfiles.id, PROFILE_ID))
      .run()
  }

  return getProfile()!
}
