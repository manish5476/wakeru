import morgan from 'morgan';
import { morganStream } from '../config/logger';

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream: morganStream }
);