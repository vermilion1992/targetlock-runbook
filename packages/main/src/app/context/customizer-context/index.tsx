'use client'

import { createContext, useState, ReactNode, useEffect } from 'react'
import { useTheme } from 'next-themes'
import config from '../config'
import React from 'react'

// Define context type
interface CustomizerContextState {
  activeDir: string
  setActiveDir: (dir: string) => void
  activeMode: string
  setActiveMode: (mode: string) => void
  activeTheme: string
  setActiveTheme: (theme: string) => void
  activeLayout: string
  setActiveLayout: (layout: string) => void
  isCardShadow: boolean
  setIsCardShadow: (shadow: boolean) => void
  isLayout: string
  setIsLayout: (layout: string) => void
  isBorderRadius: number
  setIsBorderRadius: (radius: number) => void
  isCollapse: string
  setIsCollapse: (collapse: string) => void
  isLanguage: string
  setIsLanguage: (lang: string) => void
}

export const CustomizerContext = createContext<CustomizerContextState | any>(
  undefined
)

interface CustomizerContextProps {
  children: ReactNode
}

// Persistent state helper
function usePersistentState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const getInitial = (): T => {
    if (typeof window === 'undefined')
      return typeof defaultValue === 'function'
        ? (defaultValue as () => T)()
        : defaultValue
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      try {
        return JSON.parse(stored)
      } catch {
        return stored as unknown as T
      }
    }
    return typeof defaultValue === 'function'
      ? (defaultValue as () => T)()
      : defaultValue
  }

  const [state, setState] = useState<T>(getInitial)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(state))
    }
  }, [key, state])

  return [state, setState]
}

// Provider
export const CustomizerContextProvider: React.FC<CustomizerContextProps> = ({
  children,
}) => {
  const { theme: activeMode, setTheme: setActiveMode } = useTheme() // ✅ From next-themes

  // keep your other persistent states
  const [activeDir, setActiveDir] = usePersistentState<string>(
    'activeDir',
    config.activeDir
  )
  const [activeTheme, setActiveTheme] = usePersistentState<string>(
    'activeTheme',
    config.activeTheme
  )
  const [activeLayout, setActiveLayout] = usePersistentState<string>(
    'activeLayout',
    config.activeLayout
  )
  const [isCardShadow, setIsCardShadow] = usePersistentState<boolean>(
    'isCardShadow',
    config.isCardShadow
  )
  const [isLayout, setIsLayout] = usePersistentState<string>(
    'isLayout',
    config.isLayout
  )
  const [isBorderRadius, setIsBorderRadius] = usePersistentState<number>(
    'isBorderRadius',
    config.isBorderRadius
  )
  const [isCollapse, setIsCollapse] = usePersistentState<string>(
    'isCollapse',
    config.isCollapse
  )
  const [isLanguage, setIsLanguage] = usePersistentState<string>(
    'isLanguage',
    config.isLanguage
  )

  // ✅ Apply non-theme attributes to <html>
  useEffect(() => {
    document.documentElement.setAttribute('dir', activeDir)
    document.documentElement.setAttribute('data-color-theme', activeTheme)
    document.documentElement.setAttribute('data-layout', activeLayout)
    document.documentElement.setAttribute('data-boxed-layout', isLayout)
    document.documentElement.setAttribute('data-sidebar-type', isCollapse)
  }, [activeDir, activeTheme, activeLayout, isLayout, isCollapse])

  return (
    <CustomizerContext.Provider
      value={{
        activeDir,
        setActiveDir,
        activeMode,
        setActiveMode,
        activeTheme,
        setActiveTheme,
        activeLayout,
        setActiveLayout,
        isCardShadow,
        setIsCardShadow,
        isLayout,
        setIsLayout,
        isBorderRadius,
        setIsBorderRadius,
        isCollapse,
        setIsCollapse,
        isLanguage,
        setIsLanguage,
      }}>
      {children}
    </CustomizerContext.Provider>
  )
}
