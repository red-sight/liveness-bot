import { defineStore } from 'pinia';
import { Loading } from 'quasar';
import { setCssVar } from 'quasar';

export const useInitStore = defineStore('init', {
  state: () => ({
    loading: false,
  }),
  actions: {
    async verifyInitData(webApp: Telegram['WebApp']) {
      Loading.show({
        message: `Hello, ${webApp.initDataUnsafe.user?.first_name}! Authorizing you...`,
        customClass: 'loading-global',
        spinnerSize: 48,
        spinnerColor: 'primary',
      });
    },

    initStyles(webApp: Telegram['WebApp']) {
      setCssVar('dark', webApp.themeParams.bg_color);
      setCssVar('dark-page', webApp.themeParams.bg_color);
      setCssVar('light', webApp.themeParams.bg_color);
      setCssVar('light-page', webApp.themeParams.bg_color);

      setCssVar('webapp-text', webApp.themeParams.text_color);
      setCssVar('webapp-background', webApp.themeParams.bg_color);
    },
  },
});
