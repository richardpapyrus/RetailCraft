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
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://app.retailcraft.com.ng",
    "https://retailcraft.com.ng",
    "https://www.retailcraft.com.ng",
    "https://staging.retailcraft.com.ng", // Explicit Staging Whitelist
    /\.retailcraft\.com\.ng$/,
  ];

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
  if (process.env.CORS_ORIGIN) {
    allowedOrigins.push(process.env.CORS_ORIGIN);
  }

  app.enableCors({
    // ALLOW ALL (Reflect Origin) to permit Staging/Prod/Custom domains without config
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Content-Type, Key, Authorization, X-Requested-With",
  });

  // Global Request Logger
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
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
  // Force Restart for Reports Module
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log("✅ Backend Ready & Watching (Attempts: 2)");
}
bootstrap();
