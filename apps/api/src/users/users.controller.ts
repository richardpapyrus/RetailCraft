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
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import * as bcrypt from "bcrypt";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  async findAll(@Request() req, @Query('storeId') queryStoreId?: string) {
    const storeId = queryStoreId === 'undefined' || queryStoreId === 'null' ? undefined : queryStoreId;
    return this.usersService.findAll(req.user.tenantId, storeId);
  }

  @Post()
  async create(@Request() req, @Body() body) {
    // Hash password before sending to service
    if (body.password) {
      const salt = await bcrypt.genSalt();
      body.password = await bcrypt.hash(body.password, salt);
    }
    return this.usersService.create(req.user.tenantId, body);
  }

  @Post('invite')
  async invite(@Request() req, @Body() body: { email: string; roleId: string; storeId?: string }) {
    return this.usersService.inviteUser(
      req.user.tenantId,
      body.email,
      body.roleId,
      body.storeId
    );
  }

  @Patch(":id")
  async update(@Request() req, @Param("id") id: string, @Body() body) {
    if (body.password) {
      const salt = await bcrypt.genSalt();
      body.password = await bcrypt.hash(body.password, salt);
    }
    return this.usersService.update(id, req.user.tenantId, body);
  }

  @Delete(":id")
  async delete(@Request() req, @Param("id") id: string) {
    return this.usersService.delete(id, req.user.tenantId);
  }
}
