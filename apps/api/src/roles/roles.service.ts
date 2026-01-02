import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PERMISSION_GROUPS } from "../common/constants/permissions";

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  getAvailablePermissions() {
    return PERMISSION_GROUPS;
  }

  async findAll(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { _count: { select: { users: true } } },
    });
  }

  async create(
    tenantId: string,
    data: { name: string; description?: string; permissions: string[] },
  ) {
    // Check uniqueness
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: { equals: data.name, mode: "insensitive" } },
    });
    if (existing)
      throw new BadRequestException("Role with this name already exists");

    return this.prisma.role.create({
      data: {
        ...data,
        tenantId,
        isSystem: false,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: { name?: string; description?: string; permissions?: string[] },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role || role.tenantId !== tenantId)
      throw new NotFoundException("Role not found");

    if (role.isSystem && data.name && data.name !== role.name) {
      throw new BadRequestException("Cannot rename system roles");
    }

    return this.prisma.role.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role || role.tenantId !== tenantId)
      throw new NotFoundException("Role not found");

    if (role.isSystem) {
      throw new BadRequestException("Cannot delete system roles");
    }

    if (role._count.users > 0) {
      throw new BadRequestException("Cannot delete role assigned to users");
    }

    return this.prisma.role.delete({ where: { id } });
  }
}
