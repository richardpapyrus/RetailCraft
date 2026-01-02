import { Module } from "@nestjs/common";
import { TillsService } from "./tills.service";
import { TillsController } from "./tills.controller";

@Module({
  imports: [],
  controllers: [TillsController],
  providers: [TillsService],
  exports: [TillsService],
})
export class TillsModule {}
