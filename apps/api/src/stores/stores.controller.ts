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
  Query,
} from "@nestjs/common";
import { StoresService } from "./stores.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("stores")
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) { }

  @Get()
  async findAll(@Request() req, @Query('storeId') queryStoreId?: string) {
    const storeId = queryStoreId === 'undefined' || queryStoreId === 'null' ? undefined : queryStoreId;
    // If strict isolation is required, filter by query storeId
    return this.storesService.findAll(req.user.tenantId, storeId);
  }

  @Post()
  async create(@Request() req, @Body() body) {
    return this.storesService.create(req.user.tenantId, body);
  }

  @Patch(":id")
  async update(@Request() req, @Param("id") id: string, @Body() body) {
    return this.storesService.update(id, req.user.tenantId, body);
  }

  @Delete(":id")
  async delete(@Request() req, @Param("id") id: string) {
    return this.storesService.delete(id, req.user.tenantId);
  }
}
