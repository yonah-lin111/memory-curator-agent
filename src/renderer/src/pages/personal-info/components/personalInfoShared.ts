export type PersonalInfoPageMode = "view" | "edit"

export type PersonalProfile = {
  id: number
  avatar: string
  name: string
  gender: string
  status: string
  birthday: string
  contact: string
  tags: string[]
  details: string
  createdAt: string
  updatedAt: string
}

export type PersonalProfilePayload = Omit<PersonalProfile, "id" | "createdAt" | "updatedAt">

export type FormState = {
  avatar: string
  name: string
  gender: string
  status: string
  birthday: string
  contact: string
  tags: string[]
  details: string
}

export const initialFormState: FormState = {
  avatar: "",
  name: "",
  gender: "男",
  status: "",
  birthday: "",
  contact: "",
  tags: [],
  details: "",
}
