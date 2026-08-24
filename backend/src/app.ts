import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, requestLogger } from './middlewares/index.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin,
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(express.json());
app.use('/api', routes);
app.use(errorHandler);

export default app;
