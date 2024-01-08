import { boot } from 'quasar/wrappers';
import { useInitStore } from 'src/stores/init';

export default boot(async ({ router }) => {
  const webApp = window.Telegram.WebApp;
  const initStore = useInitStore();

  webApp.ready();

  if (!webApp.initData.length) router.push({ name: 'unauth' });
  else {
    initStore.initStyles(webApp);
    webApp.onEvent('themeChanged', () => initStore.initStyles(webApp));

    await initStore.verifyInitData(webApp);
  }
});
