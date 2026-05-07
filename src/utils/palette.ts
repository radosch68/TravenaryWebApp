export type PaletteId =
  | 'classic-slate'
  | 'forest-mint'
  | 'sunset-coral'
  | 'ocean-blue'
  | 'sand-olive'
  | 'berry-ink'
  | 'everforest-official'

export type PaletteMode = 'light' | 'dark'

export type PaletteDefinition = {
  id: PaletteId
  labelKey: string
  descriptionKey: string
  tokens: Record<string, string>
}

const STORAGE_KEY = 'travenary.palette'
const PALETTE_TOKEN_KEYS: ReadonlyArray<string> = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--border',
  '--input',
  '--ring',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
]

export const PALETTES: ReadonlyArray<PaletteDefinition> = [
  {
    id: 'classic-slate',
    labelKey: 'settings.palette.options.classicSlate.label',
    descriptionKey: 'settings.palette.options.classicSlate.description',
    tokens: {
      '--background': '#f5f5f5',
      '--foreground': '#222222',
      '--card': '#ffffff',
      '--card-foreground': '#222222',
      '--popover': '#ffffff',
      '--popover-foreground': '#222222',
      '--primary': '#1f1f1f',
      '--primary-foreground': '#f7f7f7',
      '--secondary': '#ececec',
      '--secondary-foreground': '#4a4a4a',
      '--muted': '#ebebeb',
      '--muted-foreground': '#6a6a6a',
      '--accent': '#5f7fa3',
      '--accent-foreground': '#f6f8fb',
      '--destructive': '#c25a5a',
      '--border': '#cfcfcf',
      '--input': '#cfcfcf',
      '--ring': '#1f1f1f',
      '--sidebar': '#ffffff',
      '--sidebar-foreground': '#222222',
      '--sidebar-primary': '#1f1f1f',
      '--sidebar-primary-foreground': '#f7f7f7',
      '--sidebar-accent': '#ececec',
      '--sidebar-accent-foreground': '#4a4a4a',
      '--sidebar-border': '#cfcfcf',
      '--sidebar-ring': '#1f1f1f',
      '--chart-1': '#1f1f1f',
      '--chart-2': '#5f7fa3',
      '--chart-3': '#9a9a9a',
      '--chart-4': '#7b7b7b',
      '--chart-5': '#c25a5a',
    },
  },
  {
    id: 'forest-mint',
    labelKey: 'settings.palette.options.forestMint.label',
    descriptionKey: 'settings.palette.options.forestMint.description',
    tokens: {
      '--background': '#f2f6f3',
      '--foreground': '#1c2b23',
      '--card': '#fdfefd',
      '--card-foreground': '#1c2b23',
      '--popover': '#fdfefd',
      '--popover-foreground': '#1c2b23',
      '--primary': '#1f5d45',
      '--primary-foreground': '#f7fffb',
      '--secondary': '#deebe3',
      '--secondary-foreground': '#315647',
      '--muted': '#e7f0eb',
      '--muted-foreground': '#5f786d',
      '--accent': '#4f8770',
      '--accent-foreground': '#f3fbf7',
      '--destructive': '#b74848',
      '--border': '#c4d6cc',
      '--input': '#c4d6cc',
      '--ring': '#1f5d45',
      '--sidebar': '#fdfefd',
      '--sidebar-foreground': '#1c2b23',
      '--sidebar-primary': '#1f5d45',
      '--sidebar-primary-foreground': '#f7fffb',
      '--sidebar-accent': '#deebe3',
      '--sidebar-accent-foreground': '#315647',
      '--sidebar-border': '#c4d6cc',
      '--sidebar-ring': '#1f5d45',
      '--chart-1': '#1f5d45',
      '--chart-2': '#4f8770',
      '--chart-3': '#6ca48a',
      '--chart-4': '#8cbba4',
      '--chart-5': '#b74848',
    },
  },
  {
    id: 'sunset-coral',
    labelKey: 'settings.palette.options.sunsetCoral.label',
    descriptionKey: 'settings.palette.options.sunsetCoral.description',
    tokens: {
      '--background': '#fbf3ef',
      '--foreground': '#38251f',
      '--card': '#fffdfc',
      '--card-foreground': '#38251f',
      '--popover': '#fffdfc',
      '--popover-foreground': '#38251f',
      '--primary': '#b8583d',
      '--primary-foreground': '#fff8f5',
      '--secondary': '#f2ddd5',
      '--secondary-foreground': '#6f4338',
      '--muted': '#f6e8e2',
      '--muted-foreground': '#8c6a5f',
      '--accent': '#8c6cc9',
      '--accent-foreground': '#fbf8ff',
      '--destructive': '#c13f4d',
      '--border': '#dfc4ba',
      '--input': '#dfc4ba',
      '--ring': '#b8583d',
      '--sidebar': '#fffdfc',
      '--sidebar-foreground': '#38251f',
      '--sidebar-primary': '#b8583d',
      '--sidebar-primary-foreground': '#fff8f5',
      '--sidebar-accent': '#f2ddd5',
      '--sidebar-accent-foreground': '#6f4338',
      '--sidebar-border': '#dfc4ba',
      '--sidebar-ring': '#b8583d',
      '--chart-1': '#b8583d',
      '--chart-2': '#8c6cc9',
      '--chart-3': '#d17c62',
      '--chart-4': '#8f5f52',
      '--chart-5': '#c13f4d',
    },
  },
  {
    id: 'ocean-blue',
    labelKey: 'settings.palette.options.oceanBlue.label',
    descriptionKey: 'settings.palette.options.oceanBlue.description',
    tokens: {
      '--background': '#eff4fa',
      '--foreground': '#1f2d3d',
      '--card': '#fcfdff',
      '--card-foreground': '#1f2d3d',
      '--popover': '#fcfdff',
      '--popover-foreground': '#1f2d3d',
      '--primary': '#315d8a',
      '--primary-foreground': '#f4f9ff',
      '--secondary': '#dbe7f3',
      '--secondary-foreground': '#3f5870',
      '--muted': '#e7eef6',
      '--muted-foreground': '#6a7f95',
      '--accent': '#4f8bbd',
      '--accent-foreground': '#f3f9ff',
      '--destructive': '#be4a54',
      '--border': '#c2d2e3',
      '--input': '#c2d2e3',
      '--ring': '#315d8a',
      '--sidebar': '#fcfdff',
      '--sidebar-foreground': '#1f2d3d',
      '--sidebar-primary': '#315d8a',
      '--sidebar-primary-foreground': '#f4f9ff',
      '--sidebar-accent': '#dbe7f3',
      '--sidebar-accent-foreground': '#3f5870',
      '--sidebar-border': '#c2d2e3',
      '--sidebar-ring': '#315d8a',
      '--chart-1': '#315d8a',
      '--chart-2': '#4f8bbd',
      '--chart-3': '#6ea3ce',
      '--chart-4': '#5d7690',
      '--chart-5': '#be4a54',
    },
  },
  {
    id: 'sand-olive',
    labelKey: 'settings.palette.options.sandOlive.label',
    descriptionKey: 'settings.palette.options.sandOlive.description',
    tokens: {
      '--background': '#f7f4ec',
      '--foreground': '#2f2a1f',
      '--card': '#fffdf8',
      '--card-foreground': '#2f2a1f',
      '--popover': '#fffdf8',
      '--popover-foreground': '#2f2a1f',
      '--primary': '#5d5c3d',
      '--primary-foreground': '#f8f8f1',
      '--secondary': '#ece4d2',
      '--secondary-foreground': '#595137',
      '--muted': '#f1eadc',
      '--muted-foreground': '#7c7458',
      '--accent': '#b58f56',
      '--accent-foreground': '#fffaf1',
      '--destructive': '#b95045',
      '--border': '#d8ccb3',
      '--input': '#d8ccb3',
      '--ring': '#5d5c3d',
      '--sidebar': '#fffdf8',
      '--sidebar-foreground': '#2f2a1f',
      '--sidebar-primary': '#5d5c3d',
      '--sidebar-primary-foreground': '#f8f8f1',
      '--sidebar-accent': '#ece4d2',
      '--sidebar-accent-foreground': '#595137',
      '--sidebar-border': '#d8ccb3',
      '--sidebar-ring': '#5d5c3d',
      '--chart-1': '#5d5c3d',
      '--chart-2': '#b58f56',
      '--chart-3': '#9b8f6f',
      '--chart-4': '#7a6c52',
      '--chart-5': '#b95045',
    },
  },
  {
    id: 'berry-ink',
    labelKey: 'settings.palette.options.berryInk.label',
    descriptionKey: 'settings.palette.options.berryInk.description',
    tokens: {
      '--background': '#f6f1f7',
      '--foreground': '#2b2233',
      '--card': '#fefcff',
      '--card-foreground': '#2b2233',
      '--popover': '#fefcff',
      '--popover-foreground': '#2b2233',
      '--primary': '#46344f',
      '--primary-foreground': '#f7f2f9',
      '--secondary': '#e7deea',
      '--secondary-foreground': '#5f4c67',
      '--muted': '#ede6f0',
      '--muted-foreground': '#7b6b84',
      '--accent': '#7e5f9d',
      '--accent-foreground': '#fbf8ff',
      '--destructive': '#c24d68',
      '--border': '#d2c5d8',
      '--input': '#d2c5d8',
      '--ring': '#46344f',
      '--sidebar': '#fefcff',
      '--sidebar-foreground': '#2b2233',
      '--sidebar-primary': '#46344f',
      '--sidebar-primary-foreground': '#f7f2f9',
      '--sidebar-accent': '#e7deea',
      '--sidebar-accent-foreground': '#5f4c67',
      '--sidebar-border': '#d2c5d8',
      '--sidebar-ring': '#46344f',
      '--chart-1': '#46344f',
      '--chart-2': '#7e5f9d',
      '--chart-3': '#9b7ab8',
      '--chart-4': '#7c658e',
      '--chart-5': '#c24d68',
    },
  },
  {
    id: 'everforest-official',
    labelKey: 'settings.palette.options.everforestOfficial.label',
    descriptionKey: 'settings.palette.options.everforestOfficial.description',
    tokens: {
      '--background': '#f3ead3',
      '--foreground': '#5c6a72',
      '--card': '#fff9e8',
      '--card-foreground': '#5c6a72',
      '--popover': '#fff9e8',
      '--popover-foreground': '#5c6a72',
      '--primary': '#8da101',
      '--primary-foreground': '#fdf6e3',
      '--secondary': '#d8ceb7',
      '--secondary-foreground': '#56635f',
      '--muted': '#e6dcc4',
      '--muted-foreground': '#829181',
      '--accent': '#3a94c5',
      '--accent-foreground': '#fdf6e3',
      '--destructive': '#f85552',
      '--border': '#d4c9b2',
      '--input': '#d4c9b2',
      '--ring': '#8da101',
      '--sidebar': '#fff9e8',
      '--sidebar-foreground': '#5c6a72',
      '--sidebar-primary': '#8da101',
      '--sidebar-primary-foreground': '#fdf6e3',
      '--sidebar-accent': '#e6dcc4',
      '--sidebar-accent-foreground': '#56635f',
      '--sidebar-border': '#d4c9b2',
      '--sidebar-ring': '#8da101',
      '--chart-1': '#8da101',
      '--chart-2': '#3a94c5',
      '--chart-3': '#d6995b',
      '--chart-4': '#a7b6a2',
      '--chart-5': '#f85552',
    },
  },
]

function getFallbackPaletteId(): PaletteId {
  return PALETTES[0].id
}

export function getPaletteById(id: string | null | undefined): PaletteDefinition {
  if (!id) {
    return PALETTES[0]
  }

  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0]
}

export function getSavedPaletteId(): PaletteId {
  if (typeof window === 'undefined') {
    return getFallbackPaletteId()
  }

  const savedId = window.localStorage.getItem(STORAGE_KEY)
  return getPaletteById(savedId).id
}

function clearPaletteOverrides(): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  PALETTE_TOKEN_KEYS.forEach((token) => {
    root.style.removeProperty(token)
  })
}

export function applyPaletteById(paletteId: PaletteId, mode: PaletteMode = 'light'): void {
  if (typeof document === 'undefined') {
    return
  }

  if (mode === 'dark') {
    clearPaletteOverrides()
    return
  }

  const palette = getPaletteById(paletteId)
  const root = document.documentElement

  Object.entries(palette.tokens).forEach(([token, value]) => {
    root.style.setProperty(token, value)
  })
}

export function savePaletteId(paletteId: PaletteId): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, paletteId)
}

export function applySavedPalette(mode: PaletteMode = 'light'): void {
  applyPaletteById(getSavedPaletteId(), mode)
}