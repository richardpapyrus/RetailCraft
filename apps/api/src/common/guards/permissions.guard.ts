import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      "permissions",
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) return false;

    // Wildcard / Super Admin Check
    if (user.permissions.includes("*")) return true;

    // Check if user has ALL required permissions
    return requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );
  }
}
