
import { Module } from '@nestjs/common';
import { TillReportsController } from './till-reports.controller';
import { TillReportsService } from './till-reports.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [TillReportsController],
    providers: [TillReportsService],
})
export class TillReportsModule { }
