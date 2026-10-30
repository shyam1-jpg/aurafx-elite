const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const webShims = {
  'react-native-google-mobile-ads': path.resolve(__dirname, 'shims/google-mobile-ads.ts'),
  'react-native-purchases': path.resolve(__dirname, 'shims/purchases.ts'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webShims[moduleName]) {
    return { filePath: webShims[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
