import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global() // Make it global to avoid importing in every module
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
