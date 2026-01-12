import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule], // Ensure Prisma is available
    controllers: [CategoriesController],
    providers: [CategoriesService],
    exports: [CategoriesService]
})
export class CategoriesModule { }
