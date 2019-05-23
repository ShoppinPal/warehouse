import {Component, OnInit} from '@angular/core';
import {OrgModelApi} from "../../../../shared/lb-sdk/services/custom/OrgModel";
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, combineLatest} from 'rxjs';
import {ToastrService} from 'ngx-toastr';
import {UserProfileService} from "../../../../shared/services/user-profile.service";
import {LoopBackAuth} from "../../../../shared/lb-sdk/services/core/auth.service";
import {constants} from "../../../../shared/constants/constants";
import {DatePipe} from '@angular/common';

@Component({
  selector: 'app-complete',
  templateUrl: 'complete.component.html',
  styleUrls: ['complete.component.scss']
})
export class CompleteComponent implements OnInit {

  public userProfile: any;
  public order: any;
  public loading: boolean;
  public currentPage: number;
  public lineItemsLimitPerPage: number = 100;
  public lineItems: Array<any>;
  public totalLineItems: number;

  constructor(private orgModelApi: OrgModelApi,
              private _route: ActivatedRoute,
              private _router: Router,
              private toastr: ToastrService,
              private _userProfileService: UserProfileService,
              private auth: LoopBackAuth) {
  }

  ngOnInit() {
    this.userProfile = this._userProfileService.getProfileData();

    this._route.data.subscribe((data: any) => {
        this.order = data.stockOrderDetails[0];
        this.getStockOrderLineItems();
      },
      error => {
        console.log('error', error)
      });
  }

  getStockOrderLineItems(limit?: number, skip?: number, productModelId?: string) {
    if (!(limit && skip)) {
      limit = 100;
      skip = 0;
    }
    let filter = {
      where: {
        reportModelId: this.order.id,
        productModelId: productModelId
      },
      include: {
        relation: 'productModel'
      },
      limit: limit,
      skip: skip
    };
    let countFilter = {
      reportModelId: this.order.id
    };
    if (productModelId)
      countFilter['productModelId'] = productModelId;
    this.loading = true;
    let fetchLineItems = combineLatest(
      this.orgModelApi.getStockOrderLineitemModels(this.userProfile.orgModelId, filter),
      this.orgModelApi.countStockOrderLineitemModels(this.userProfile.orgModelId, countFilter));
    fetchLineItems.subscribe((data: any) => {
        this.loading = false;
        this.currentPage = (skip / this.lineItemsLimitPerPage) + 1;
        this.totalLineItems = data[1].count;
        this.lineItems = data[0];
      },
      err => {
        this.loading = false;
        console.log('error', err);
      });
  }

  searchProductBySku(sku?: string) {
    this.loading = true;
    this.orgModelApi.getProductModels(this.userProfile.orgModelId, {
      where: {
        api_id: sku
      }
    }).subscribe((data: any) => {
      if (data.length) {
        this.getStockOrderLineItems(1, 0, data[0].id);
      }
      else {
        this.loading = false;
        this.lineItems = [];
        this.totalLineItems = 0;
        this.currentPage = 1;
      }
    })
  }

}
