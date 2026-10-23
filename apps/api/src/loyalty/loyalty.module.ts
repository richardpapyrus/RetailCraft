import { Module } from "@nestjs/common";
import { LoyaltyExpiryService } from "./loyalty-expiry.service";

@Module({
  providers: [LoyaltyExpiryService],
})
export class LoyaltyModule {}
