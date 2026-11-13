import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'my.conceptsquad.apfood',
  appName: 'AP Food',
  webDir: 'public',
  server: {
    url: 'https://apfoods.vercel.app',
    cleartext: false,
  },
  appendUserAgent: 'APFoodNative',
  backgroundColor: '#fffefa',
};

export default config;
