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
import { TaxesService } from "./taxes.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("taxes")
@UseGuards(JwtAuthGuard)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  async findAll(@Request() req) {
    return this.taxesService.findAll(req.user.tenantId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.taxesService.create(req.user.tenantId, data);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() data: any) {
    return this.taxesService.update(id, data);
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    return this.taxesService.delete(id);
  }
}
