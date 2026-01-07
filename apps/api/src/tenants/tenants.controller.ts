import { Controller, Put, Post, Delete, Body, Param, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { TenantsService } from "./tenants.service";
// import { AuthGuard } from '../auth/auth.guard';

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) { }

  @Put(":id")
  // @UseGuards(AuthGuard) // Uncomment when AuthGuard is available/imported correctly
  async update(
    @Param("id") id: string,
    @Body() body: { currency?: string; locale?: string; logoUrl?: string; brandColor?: string },
  ) {
    return this.tenantsService.update(id, body);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    // Use relative path to avoid domain issues. 
    // The frontend/browser will resolve this against the current origin.
    // Nginx proxies /api -> Backend. 
    const logoUrl = `/api/uploads/${file.filename}`;

    // Save to DB
    await this.tenantsService.update(id, { logoUrl });

    return { logoUrl };
  }

  @Delete(':id/logo')
  async deleteLogo(@Param('id') id: string) {
    await this.tenantsService.update(id, { logoUrl: null });
    return { success: true };
  }
}
