import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enAuth from '@/i18n/locales/en/auth.json'
import enCommon from '@/i18n/locales/en/common.json'
import enErrors from '@/i18n/locales/en/errors.json'
import enProfile from '@/i18n/locales/en/profile.json'
import enAiGeneration from '@/i18n/locales/en/ai-generation.json'
import csAuth from '@/i18n/locales/cs-CZ/auth.json'
import csCommon from '@/i18n/locales/cs-CZ/common.json'
import csErrors from '@/i18n/locales/cs-CZ/errors.json'
import csProfile from '@/i18n/locales/cs-CZ/profile.json'
import csAiGeneration from '@/i18n/locales/cs-CZ/ai-generation.json'

const preferredLanguage = localStorage.getItem('preferredLanguage') || 'en'

void i18n.use(initReactI18next).init({
  lng: preferredLanguage === 'cs-CZ' ? 'cs-CZ' : 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['auth', 'profile', 'common', 'errors', 'ai-generation'],
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      auth: enAuth,
      profile: enProfile,
      common: enCommon,
      errors: enErrors,
      'ai-generation': enAiGeneration,
    },
    'cs-CZ': {
      auth: csAuth,
      profile: csProfile,
      common: csCommon,
      errors: csErrors,
      'ai-generation': csAiGeneration,
    },
  },
})

export default i18n
