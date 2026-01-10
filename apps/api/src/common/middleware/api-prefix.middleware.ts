
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ApiPrefixMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // If the request starts with /api, strip it so the Controller sees the path without it.
        // This allows the app to handle:
        // 1. Direct requests: /auth/register
        // 2. Proxied requests (Staging): /api/auth/register -> /auth/register
        if (req.url.startsWith('/api/')) {
            req.url = req.url.replace('/api/', '/');
        } else if (req.url === '/api') {
            req.url = '/';
        }

        next();
    }
}
