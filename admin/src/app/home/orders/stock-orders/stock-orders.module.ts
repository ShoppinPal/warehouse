import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockOrdersComponent } from './stock-orders.component';
import {SharedModule} from '../../../shared/shared.module';
import {FulfillModule} from "./fulfill/fulfill.module";
import {GeneratedModule} from "./generated/generated.module";
import {ReceiveModule} from "./receive/receive.module";
import {CompleteModule} from "./complete/complete.module";

@NgModule({
  imports: [
    CommonModule,
    CompleteModule,
    SharedModule,
    FulfillModule,
    GeneratedModule,
    ReceiveModule
  ],
  declarations: [StockOrdersComponent]
})
export class StockOrdersModule { }
