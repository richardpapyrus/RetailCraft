import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { TillsService } from "./tills.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("tills")
@UseGuards(JwtAuthGuard)
export class TillsController {
  constructor(private readonly tillsService: TillsService) { }

  @Post()
  create(@Body() body: { name: string; storeId: string }, @Request() req) {
    let targetStoreId = body.storeId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');

    if (!isSystemAdmin) {
      if (!req.user.storeId) throw new Error("Operation denied: No store assigned");
      targetStoreId = req.user.storeId;
    }

    if (!targetStoreId) {
      throw new BadRequestException("Store ID is required to create a till.");
    }

    return this.tillsService.createTill({
      name: body.name,
      storeId: targetStoreId,
      tenantId: req.user.tenantId,
    });
  }

  @Get()
  findAll(@Query("storeId") queryStoreId: string, @Request() req) {
    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.permissions?.includes('*');

    if (!isSystemAdmin) {
      if (req.user.storeId) {
        // If user is locked to a store, enforce it.
        storeId = req.user.storeId;
      } else {
        // If user is "Floating" (no store assigned), allow them to view the requested store.
        if (!storeId) throw new BadRequestException("Store ID required for floating staff");
      }
    }

    // Strict isolation for Tills
    return this.tillsService.getTills(req.user.tenantId, storeId);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: { name: string }) {
    return this.tillsService.updateTill(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.tillsService.deleteTill(id);
  }

  @Post("session/open")
  openSession(
    @Body() body: { tillId: string; openingFloat: number },
    @Request() req,
  ) {
    return this.tillsService.openSession({
      tillId: body.tillId,
      userId: req.user.userId,
      openingFloat: body.openingFloat,
    });
  }

  @Get("session/active")
  getActiveSession(@Request() req, @Query("storeId") storeId?: string) {
    return this.tillsService.getActiveSession(req.user.userId, storeId);
  }

  @Get("session/:id/summary")
  getSessionSummary(@Param("id") id: string) {
    return this.tillsService.getSessionSummary(id);
  }

  @Post("session/:id/close")
  closeSession(@Param("id") id: string, @Body() body: { closingCash: number }) {
    return this.tillsService.closeSession(id, body.closingCash);
  }

  @Post("transaction")
  recordTransaction(
    @Body()
    body: {
      tillSessionId: string;
      type: "CASH_IN" | "CASH_OUT";
      amount: number;
      reason: string;
    },
    @Request() req,
  ) {
    return this.tillsService.recordTransaction({
      ...body,
      userId: req.user.userId,
    });
  }
  @Get(":id/sessions")
  getSessions(@Param("id") id: string) {
    return this.tillsService.getTillSessions(id);
  }
}
