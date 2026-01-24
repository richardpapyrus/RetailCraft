import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import { ReturnsService } from "./returns.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("returns")
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) { }

  @Post()
  create(@Request() req, @Body() body: any) {
    // body: { saleId, items: [{ productId, quantity, restock }], storeId? }
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    // Fix: Prioritize explicitly sent storeId (from UI context) over Token storeId (which might be stale)
    const storeId = body.storeId || req.user.storeId;

    if (!storeId)
      throw new BadRequestException(
        "User must be in a store to process returns",
      );

    return this.returnsService.createReturn({
      ...body,
      tenantId,
      userId,
      storeId,
    });
  }
}
