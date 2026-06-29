import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { initialFormState, type FormState, type PersonalInfoPageMode, type PersonalProfile, type PersonalProfilePayload } from './personalInfoShared'

export const usePersonalInfo = () => {
  const [mode, setMode] = useState<PersonalInfoPageMode>('view')
  const [profile, setProfile] = useState<PersonalProfile | null>(null)
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [isLoading, setIsLoading] = useState(true)
  const toast = useToast()

  const loadProfile = async () => {
    setIsLoading(true)
    try {
      if (window.api?.profile) {
        const data = await window.api.profile.get()
        setProfile(data as unknown as PersonalProfile)
      } else {
        // 回退到 localStorage
        const localData = localStorage.getItem('mc_personal_info')
        if (localData) {
          setProfile(JSON.parse(localData))
        } else {
          setProfile(null)
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
      toast.error('读取个人信息失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const enterEditMode = () => {
    if (profile) {
      setFormState({
        avatar: profile.avatar,
        name: profile.name,
        gender: profile.gender,
        status: profile.status,
        birthday: profile.birthday,
        contact: profile.contact,
        tags: profile.tags,
        details: profile.details
      })
    } else {
      setFormState(initialFormState)
    }
    setMode('edit')
  }

  const handleSaveForm = async (overrideFormState?: Partial<FormState>) => {
    const currentState = { ...formState, ...overrideFormState }
    if (!currentState.name.trim()) {
      toast.warning('姓名不能为空')
      return
    }

    try {
      const payload: PersonalProfilePayload = {
        avatar: currentState.avatar,
        name: currentState.name,
        gender: currentState.gender,
        status: currentState.status,
        birthday: currentState.birthday,
        contact: currentState.contact,
        tags: currentState.tags,
        details: currentState.details
      }

      const oldAvatar = profile?.avatar

      if (window.api?.profile) {
        const saved = await window.api.profile.update(payload)
        setProfile(saved as unknown as PersonalProfile)
      } else {
        // 回退方案
        const newProfile: PersonalProfile = {
          id: 1,
          ...payload,
          createdAt: profile?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        localStorage.setItem('mc_personal_info', JSON.stringify(newProfile))
        setProfile(newProfile)
      }

      if (oldAvatar && oldAvatar.startsWith('mc-img://') && oldAvatar !== payload.avatar) {
        if (window.api?.files?.deletePersonalAvatar) {
          await window.api.files.deletePersonalAvatar(oldAvatar)
        }
      }

      toast.success('个人信息保存成功')
      setMode('view')
      
      // 派发自定义事件，通知 Sidebar 更新头像
      window.dispatchEvent(new Event('mc:personal-info-updated'))
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.error('保存失败')
    }
  }

  const handleClearProfile = async () => {
    try {
      const oldAvatar = profile?.avatar

      if (window.api?.profile) {
        await window.api.profile.clear()
      } else {
        localStorage.removeItem('mc_personal_info')
      }

      if (oldAvatar && oldAvatar.startsWith('mc-img://')) {
        if (window.api?.files?.deletePersonalAvatar) {
          window.api.files.deletePersonalAvatar(oldAvatar).catch(console.error)
        }
      }

      setProfile(null)
      toast.success('个人信息已清空')
      setMode('view')

      // 派发自定义事件，通知 Sidebar 更新头像
      window.dispatchEvent(new Event('mc:personal-info-updated'))
    } catch (error) {
      console.error('Failed to clear profile:', error)
      toast.error('清空个人信息失败')
    }
  }

  return {
    mode,
    setMode,
    profile,
    formState,
    setFormState,
    isLoading,
    enterEditMode,
    handleSaveForm,
    handleClearProfile
  }
}
