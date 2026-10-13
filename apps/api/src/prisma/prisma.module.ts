import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { prisma } from "./client";

@Global() // Make it global to avoid importing in every module
@Module({
  // Injected PrismaService is the same instance services import from ./client — one pool.
  providers: [{ provide: PrismaService, useValue: prisma }],
  exports: [PrismaService],
})
export class PrismaModule {}
