import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import todoRoutes from './routes/todoRoutes';
import pool from './config/database';


const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint for Kubernetes liveness probe
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check endpoint for Kubernetes readiness probe
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/todos', todoRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Todo List API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      todos: '/api/todos'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});


export default app;
