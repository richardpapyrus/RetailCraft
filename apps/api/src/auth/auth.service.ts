import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  private prisma = new PrismaClient();

  constructor(private jwtService: JwtService) { }

  async validateUser(email: string, pass: string): Promise<any> {


    let user;
    try {

      user = await this.prisma.user.findUnique({ where: { email } });
    } catch (e) {
      console.error("[AuthDebug] PRISMA CRASHED:", e);
      throw e;
    }

    if (!user) {

      throw new UnauthorizedException("User not found");
    }



    // Check password (Bcrypt enabled)
    const isMatch = await bcrypt.compare(pass, user.password);


    if (!isMatch) {
      throw new UnauthorizedException("Password mismatch");
    }
    const { password: _password, ...result } = user;
    return result;
  }

  async login(user: any) {
    // Fetch full user with dynamic Role definition
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        tenant: { select: { name: true, currency: true, locale: true, logoUrl: true, brandColor: true } },
        store: true,
        roleDef: true, // Include the Role entity
      },
    });

    const effectivePermissions = fullUser.roleDef?.permissions || [];

    const payload = {
      email: user.email,
      sub: user.id,
      role: fullUser.roleDef?.name || "Unknown",
      tenantId: user.tenantId,
      storeId: user.storeId,
      permissions: effectivePermissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: fullUser.name,
        role: fullUser.roleDef?.name || "Unknown",
        tenantId: user.tenantId,
        storeId: user.storeId,
        tenantName: fullUser?.tenant?.name || "Local Demo Tenant",
        currency: fullUser?.tenant?.currency || "USD",
        locale: fullUser?.tenant?.locale || "en-US",
        permissions: effectivePermissions,
        store: fullUser?.store,
        tenantLogo: fullUser?.tenant?.logoUrl,
        tenantBrandColor: fullUser?.tenant?.brandColor,
      },
    };
  }

  async getProfile(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: { select: { name: true, currency: true, locale: true, logoUrl: true, brandColor: true } },
        store: true,
        roleDef: true,
      },
    });
    if (!user) return null;

    const effectivePermissions = user.roleDef?.permissions || [];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.roleDef?.name || "Unknown",
      tenantId: user.tenantId,
      storeId: user.storeId,
      tenantName: user.tenant?.name || "Local Demo Tenant",
      currency: user.tenant?.currency || "USD",
      locale: user.tenant?.locale || "en-US",
      permissions: effectivePermissions,
      store: user.store,
      tenantLogo: user.tenant?.logoUrl,
      tenantBrandColor: user.tenant?.brandColor,
    };
  }

  async register(data: any) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Transaction: Tenant -> Roles -> Store -> User
    const user = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant (Business)
      const tenant = await tx.tenant.create({
        data: {
          name: data.businessName || "My Business",
          currency: "USD",
          locale: "en-US",
        },
      });

      // 2. Create Administrator Role
      const adminRole = await tx.role.create({
        data: {
          name: "Administrator",
          description: "Full access to all system features",
          permissions: ["*"],
          isSystem: true,
          tenantId: tenant.id,
        },
      });

      // 3. Create Default Store (Location)
      // Use 'subdomain' or explict 'storeName' if passed, otherwise 'Main Location'
      const store = await tx.store.create({
        data: {
          name: data.storeName || "Main Location",
          tenantId: tenant.id,
        },
      });

      // 4. Create Admin User
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: "Admin",
          roleId: adminRole.id, // Link to Role

          tenantId: tenant.id,
          storeId: store.id,
        },
      });

      return newUser;
    });

    return this.login(user);
  }
}
