import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {ActivatedRoute, ActivatedRouteSnapshot, Resolve, Router} from '@angular/router';
import {UserProfileService} from '../../../../../shared/services/user-profile.service';
import {OrgModelApi} from "../../../../../shared/lb-sdk/services/custom/OrgModel";
import {constants} from "../../../../../shared/constants/constants";

@Injectable({
  providedIn: 'root'
})

export class FulfillResolverService implements Resolve<string> {

  private userProfile: any = this._userProfileService.getProfileData();

  constructor(private orgModelApi: OrgModelApi,
              private _route: ActivatedRoute,
              private _router: Router,
              private _userProfileService: UserProfileService) {
  }

  resolve(route: ActivatedRouteSnapshot): Observable<any> {
    return this.fetchStockOrderDetails(route.params.id);
  }

  fetchStockOrderDetails(reportModelId): Observable<any> {
    let allowedStates = [
      constants.REPORT_STATES.FULFILMENT_PENDING,
      constants.REPORT_STATES.FULFILMENT_IN_PROCESS,
      constants.REPORT_STATES.FULFILMENT_FAILURE,
      constants.REPORT_STATES.RECEIVING_PENDING,
      constants.REPORT_STATES.RECEIVING_IN_PROCESS,
      constants.REPORT_STATES.RECEIVING_FAILURE
    ];
    let filter = {
      where: {
        id: reportModelId,
        state: {
          inq: allowedStates
        }
      },
      include: ['storeModel', 'deliverFromStoreModel', 'userModel', 'approvedByUserModel']
    };
    return this.orgModelApi.getReportModels(this.userProfile.orgModelId, filter).pipe(map((data: any) => {
        if (data.length) {
          return data;
        }
        else {
          this._router.navigate(['/orders/stock-orders']);
        }
      },
      err => {
        console.log('Could not fetch stock orders', err);
        return err;
      }));

  };

}

