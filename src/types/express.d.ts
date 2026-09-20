import { Server as SocketServer } from 'socket.io';
import { UploadedFile } from 'express-fileupload';

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  subscription_status?: string;
  profile_completed?: boolean | number;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      files?: { [key: string]: UploadedFile | UploadedFile[] } | null;
      io?: SocketServer;
    }
    interface Application {
      io?: SocketServer;
    }
  }
}
