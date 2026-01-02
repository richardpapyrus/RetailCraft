import { Controller, Put, Body, Param } from "@nestjs/common";
import { TenantsService } from "./tenants.service";
// import { AuthGuard } from '../auth/auth.guard';

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Put(":id")
  // @UseGuards(AuthGuard) // Uncomment when AuthGuard is available/imported correctly
  async update(
    @Param("id") id: string,
    @Body() body: { currency?: string; locale?: string },
  ) {
    return this.tenantsService.update(id, body);
  }
}
