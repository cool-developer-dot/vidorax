import app from './app.js';
import { env } from './config/index.js';

const startServer = (): void => {
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

startServer();
