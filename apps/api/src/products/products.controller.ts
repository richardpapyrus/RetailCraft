import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Public } from "../common/decorators/public.decorator";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("products")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  @Permissions("MANAGE_PRODUCTS")
  async importProducts(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Query('storeId') queryStoreId: string
  ) {
    const tenantId = req.user.tenantId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');

    let targetStoreId = queryStoreId;
    if (!isSystemAdmin && req.user.storeId) {
      targetStoreId = req.user.storeId;
    }
    // Sanitize string "undefined"
    if (targetStoreId === 'undefined' || targetStoreId === 'null') targetStoreId = undefined;

    return this.productsService.importProducts(tenantId, file.buffer, targetStoreId);
  }

  @Public()
  @Get("template")
  async downloadTemplate(@Res() res: Response) {
    const csvContent = `name,sku,price,description,category,barcode,costPrice,minStockLevel,quantity
Example Product,EX-001,10.00,Description here,General,12345678,5.00,10,100`;

    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="template.csv"',
    });
    res.send(csvContent);
  }

  @Post()
  @Permissions("MANAGE_PRODUCTS")
  create(@Request() req, @Body() body: any) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new Error("Tenant ID missing from user");
    }
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');

    // Determine Store ID
    // If Non-Admin: MUST be their assigned store.
    // If Admin: Can be body.storeId OR their assigned store OR null (Global) if explicitly null/undefined.
    let targetStoreId = body.storeId;
    if (!isSystemAdmin) {
      if (!req.user.storeId) throw new Error("Operation denied: No store assigned");
      targetStoreId = req.user.storeId;
    }

    return this.productsService.create({
      ...body,
      tenantId,
      price: body.price,
      supplierId: body.supplierId || undefined,
      barcode: body.barcode || undefined,
      category: body.category || undefined,
      description: body.description || undefined,
      storeId: targetStoreId || undefined, // Pass to service
    });
  }

  @Patch(":id")
  @Permissions("MANAGE_PRODUCTS")
  async update(@Param("id") id: string, @Body() body: any) {

    try {
      return await this.productsService.update(id, body);
    } catch (e) {
      console.error(`[ProductsController] Update Error`, e);
      throw e;
    }
  }

  @Get("stats")
  getStats(@Request() req, @Query('storeId') queryStoreId?: string) {
    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');
    if (!isSystemAdmin && req.user.storeId) {
      storeId = req.user.storeId;
    }
    return this.productsService.getStats(req.user.tenantId, storeId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    return this.productsService.findOne(id, req.user.tenantId);
  }

  @Get(":id/events")
  findEvents(
    @Param("id") id: string,
    @Query("skip") skip: string,
    @Query("take") take: string,
  ) {
    return this.productsService.findEvents(
      id,
      parseInt(skip || "0"),
      parseInt(take || "50"),
    );
  }

  @Get()
  findAll(
    @Request() req,
    @Query("skip") skip: string,
    @Query("take") take: string,
    @Query("search") search: string,
    @Query("category") category: string,
    @Query("lowStock") lowStock: string,
    @Query("storeId") queryStoreId: string,
  ) {
    const tenantId = req.user.tenantId; // strict security
    if (!tenantId) throw new Error("Start Session: Tenant ID missing in token");

    let storeId = queryStoreId;
    const isSystemAdmin = req.user.role === 'Administrator' || req.user.role === 'ADMIN' || req.user.permissions?.includes('*');
    if (!isSystemAdmin && req.user.storeId) {
      storeId = req.user.storeId;
    }


    return this.productsService
      .findAll(tenantId, parseInt(skip || "0"), parseInt(take || "50"), {
        search,
        category,
        lowStock: lowStock === "true",
      }, storeId)
      .then((res) => {

        return res;
      });
  }
}
