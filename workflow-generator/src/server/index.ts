import express from 'express';
import cors from 'cors';
import { generateRouter } from './routes/generate.js';

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', generateRouter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Workflow Generator API running on http://localhost:${PORT}`);
});
