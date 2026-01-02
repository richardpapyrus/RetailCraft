import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { DiscountsService } from "./discounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("discounts")
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  async findAll(@Request() req) {
    return this.discountsService.findAll(req.user.tenantId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.discountsService.create(req.user.tenantId, data);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() data: any) {
    return this.discountsService.update(id, data);
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    return this.discountsService.delete(id);
  }
}
