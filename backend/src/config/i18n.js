const i18n = require('i18n');
const path = require('path');
const logger = require('../utils/logger');

const setupI18n = async () => {
  try {
    // Configure i18n
    i18n.configure({
      locales: (process.env.SUPPORTED_LANGUAGES || 'bg,en,ru,de,fr,es').split(','),
      defaultLocale: process.env.DEFAULT_LANGUAGE || 'bg',
      directory: path.join(__dirname, '../../locales'),
      objectNotation: true,
      updateFiles: false,
      api: {
        __: 't',
        __n: 'tn'
      }
    });

    logger.info('✅ i18n configured successfully');
    
  } catch (error) {
    logger.error('❌ i18n setup failed:', error);
    throw error;
  }
};

// Translation utilities
const translate = (key, locale = 'bg', params = {}) => {
  try {
    i18n.setLocale(locale);
    return i18n.__(key, params);
  } catch (error) {
    logger.error('Translation error:', error);
    return key; // Return key if translation fails
  }
};

// Get supported languages
const getSupportedLanguages = () => {
  return i18n.getLocales();
};

// Get current locale
const getCurrentLocale = () => {
  return i18n.getLocale();
};

// Set locale
const setLocale = (locale) => {
  i18n.setLocale(locale);
};

module.exports = {
  setupI18n,
  translate,
  getSupportedLanguages,
  getCurrentLocale,
  setLocale,
  i18n
};