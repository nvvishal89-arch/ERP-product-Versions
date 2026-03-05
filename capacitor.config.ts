import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blueprintai.pro',
  appName: 'Blueprint AI Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // This allows the app to communicate with your hosted backend
    url: 'https://ais-dev-tucykxgjczqci4pjqqed23-355442699565.asia-southeast1.run.app',
    cleartext: true
  }
};

export default config;
