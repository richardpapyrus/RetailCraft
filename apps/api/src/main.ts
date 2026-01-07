import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://app.retailcraft.com.ng",
      "https://www.retailcraft.com.ng",
      /\.retailcraft\.com\.ng$/
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });
  await app.listen(process.env.PORT || 4000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log("✅ Backend Ready & Watching (Reset)");
}
bootstrap();
