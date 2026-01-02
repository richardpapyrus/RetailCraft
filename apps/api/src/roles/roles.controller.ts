import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { RolesService } from "./roles.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Permissions } from "../common/decorators/permissions.decorator";

@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions("MANAGE_USERS") // Assuming managing roles falls under user management
  create(@Request() req, @Body() body: any) {
    return this.rolesService.create(req.user.tenantId, body);
  }

  @Get()
  @Permissions("MANAGE_USERS")
  findAll(@Request() req) {
    return this.rolesService.findAll(req.user.tenantId);
  }

  @Get("permissions")
  @Permissions("MANAGE_USERS")
  getPermissions() {
    return this.rolesService.getAvailablePermissions();
  }

  @Patch(":id")
  @Permissions("MANAGE_USERS")
  update(@Request() req, @Param("id") id: string, @Body() body: any) {
    return this.rolesService.update(req.user.tenantId, id, body);
  }

  @Delete(":id")
  @Permissions("MANAGE_USERS")
  remove(@Request() req, @Param("id") id: string) {
    return this.rolesService.remove(req.user.tenantId, id);
  }
}
