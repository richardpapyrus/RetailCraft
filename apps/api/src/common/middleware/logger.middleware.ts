import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    res.on("finish", () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const logLevel = statusCode >= 400 ? "warn" : "log";

      this.logger[logLevel](
        `${method} ${originalUrl} ${statusCode} - ${duration}ms [${ip}]`,
      );
    });

    next();
  }
}
