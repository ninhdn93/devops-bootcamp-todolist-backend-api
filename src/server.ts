import dotenv from 'dotenv';
import app from './app';
import todoModel from './models/todoModel';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await todoModel.initDatabase();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Readiness check: http://localhost:${PORT}/ready`);
      console.log(`API endpoint: http://localhost:${PORT}/api/todos`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();