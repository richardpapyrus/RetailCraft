import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Post("business")
  async updateBusiness(
    @Request() req,
    @Body() body: { name: string; currency: string; locale: string },
  ) {
    return this.onboardingService.updateBusinessProfile(
      req.user.tenantId,
      body,
    );
  }

  @Post("store")
  async updateStore(
    @Request() req,
    @Body() body: { name?: string; address: string; phone: string },
  ) {
    // Assuming user's storeId is populated in the token/request
    return this.onboardingService.updateStoreDetails(req.user.storeId, body);
  }

  @Post("tax")
  async createTax(
    @Request() req,
    @Body() body: { name: string; rate: number },
  ) {
    return this.onboardingService.createTax(req.user.tenantId, body);
  }

  @Post("product")
  async createProduct(
    @Request() req,
    @Body() body: { name: string; price: number; sku: string },
  ) {
    return this.onboardingService.createProduct(req.user.tenantId, body);
  }

  @Post("complete")
  async complete(@Request() req) {
    return this.onboardingService.completeOnboarding(req.user.tenantId);
  }
}
