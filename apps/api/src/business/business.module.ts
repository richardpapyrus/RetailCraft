import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { SalesModule } from '../sales/sales.module';

@Module({
    imports: [SalesModule],
    controllers: [BusinessController],
})
export class BusinessModule { }
