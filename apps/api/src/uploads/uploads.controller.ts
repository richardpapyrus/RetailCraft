import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller('uploads')
export class UploadsController {
    @Get(':filename')
    serveFile(@Param('filename') filename: string, @Res() res: Response) {
        // Robust path resolution
        const filePath = join(process.cwd(), 'uploads', filename);

        if (!existsSync(filePath)) {
            console.error(`[Uploads] File not found: ${filePath}`);
            throw new NotFoundException('File not found');
        }

        return res.sendFile(filePath);
    }

    @Get('debug/list')
    listFileDebug() {
        const uploadDir = join(process.cwd(), 'uploads');
        const exists = existsSync(uploadDir);
        let files: string[] = [];
        try {
            const fs = require('fs');
            if (exists) files = fs.readdirSync(uploadDir);
        } catch (e) {
            files = [`Error: ${e.message}`];
        }

        return {
            cwd: process.cwd(),
            uploadDir,
            exists,
            files,
            env: {
                NODE_ENV: process.env.NODE_ENV,
                APP_URL: process.env.APP_URL
            }
        };
    }
}
