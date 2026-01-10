import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Force Reload Trigger
  console.log("Starting API Server...");

  // Serve Uploads (e.g. Logos)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/api/uploads/',
  });
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://app.retailcraft.com.ng",
      "https://retailcraft.com.ng",
      "https://www.retailcraft.com.ng",
      /\.retailcraft\.com\.ng$/,
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Content-Type, Key, Authorization, X-Requested-With",
  });

  // --- SELF HEALING LOGIC ---
  try {
    const prisma = app.get(PrismaService);
    // 1. Ensure Tenant
    const tenant = await prisma.tenant.upsert({
      where: { id: 'default-tenant-id' },
      update: {},
      create: { id: 'default-tenant-id', name: 'Local Demo Tenant' },
    });
    // 2. Ensure Store
    const store = await prisma.store.upsert({
      where: { id: 'default-store-id' },
      update: {},
      create: { id: 'default-store-id', name: 'Main Store - Local', tenantId: tenant.id },
    });
    // 3. Ensure Admin Role
    const adminRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Administrator' } },
      update: {},
      create: {
        name: 'Administrator',
        description: 'System Administrator - Full Access',
        permissions: ['*'],
        isSystem: true,
        tenantId: tenant.id
      }
    });
    // 4. Ensure Admin User
    const hash = '$2b$10$CmG.jD/lCrNS.PlApZYUYOWNTCBt7pnW0GFzpWsnRlSQUcOQcLMKu'; // Password: password
    const adminEmail = 'admin@pos.local';
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { roleId: adminRole.id },
      create: {
        email: adminEmail,
        password: hash,
        name: 'System Admin',
        roleId: adminRole.id,
        tenantId: tenant.id,
        storeId: store.id
      }
    });
    console.log('✅ [Self-Heal] Connectivity & Admin User Verified.');
  } catch (e) {
    console.error('⚠️ [Self-Heal] Warning:', e);
  }
  // --- END SELF HEALING ---

  await app.listen(process.env.PORT || 4000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log("✅ Backend Ready & Watching (Reset)");
}
bootstrap();
