// Render web-service entrypoint: bind the panel before loading bot dependencies.
const { startPanelServer } = require('./panel-server');

startPanelServer();
require('./index');
