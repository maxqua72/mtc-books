import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pdfRouter } from './routes/pdfRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || '100mb';

// Middleware
app.use(cors());
app.use(express.json({ limit: MAX_BODY_SIZE }));
app.use(express.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));

// Rotte API (Prefisso /api per Nginx)
app.use('/api', pdfRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', service: 'MTC Books PDF Service' });
});

app.listen(PORT, () => {
  console.log(`Server PDF MTC Books in ascolto sulla porta ${PORT}`);
});