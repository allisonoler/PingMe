module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  if (process.env.GOOGLE_MAPS_API_KEY) {
    plugins.push(['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }]);
  }
  return { ...config, plugins };
};
