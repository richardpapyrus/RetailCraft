import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

// The app uses the single instance from ./client (see PrismaModule); @Optional
// keeps the class constructible by Nest's DI too (e.g. in tests).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(@Optional() options?: Prisma.PrismaClientOptions) {
    super(options);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
