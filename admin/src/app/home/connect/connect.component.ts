import {Component, OnInit, ChangeDetectorRef} from '@angular/core';
import {OrgModelApi} from "../../shared/lb-sdk/services/custom/OrgModel";
import {ActivatedRoute} from '@angular/router';
import {UserProfileService} from "../../shared/services/user-profile.service";
import {ToastrService} from 'ngx-toastr';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  constructor(private orgModelApi: OrgModelApi,
              private _route: ActivatedRoute,
              private _userProfileService: UserProfileService,
              private cd: ChangeDetectorRef,
              private toastr: ToastrService) {
  }

  public userProfile: any = this._userProfileService.getProfileData();
  public integration: any;
  public syncModels: number;
  public loading: boolean = false;
  public selectedCompany: string;
  public databaseName: string;

  ngOnInit() {
    this._route.data.subscribe((data: any) => {
        this.integration = data.integration.integration;
        this.syncModels = data.integration.syncModels;
        this.selectedCompany = this.integration && this.integration.length ? this.integration[0].dataAreaId : '';
      },
      error => {
        console.log('error', error)
      });
  }

  private connect(integrationType: string) {
    this.loading = true;
    this.orgModelApi.fetchAuthorizationUrl(this.userProfile.orgModelId, integrationType)
      .subscribe((data: any) => {
          console.log('fetched auth url', data.authorizationUrl);
          window.location.href = data.authorizationUrl;
        },
        err => {
          this.loading = false;
          console.log('error', err);
        });
  }

  private initiateVendSync() {
    this.loading = true;
    this.orgModelApi.initiateVendSync(this.userProfile.orgModelId)
      .subscribe((data: any) => {
          console.log('vend sync', data);
          this.loading = false;
        },
        err => {
          this.loading = false;
          console.log('err', err);
        });
  }

  private initiateMSDSync() {
    if (!this.integration[0].dataAreaId) {
      this.toastr.error('Please select a company first');
    }
    else if (!this.integration[0].databaseName) {
      this.toastr.error('Please enter the SQL Database name');
    }
    else {
      this.loading = true;
      this.orgModelApi.initiateMSDSync(this.userProfile.orgModelId)
        .subscribe((data: any) => {
            console.log('msd sync', data);
            this.syncModels = data.syncStatus;
            this.loading = false;
            this.cd.markForCheck();
          },
          err => {
            this.loading = false;
            console.log('err', err);
          });
    }
  }

  private stopMSDSync() {
    this.loading = true;
    this.orgModelApi.stopMSDSync(this.userProfile.orgModelId)
      .subscribe((data: any) => {
          console.log(' stopped msd sync', data);
          this.loading = false;
          this.syncModels = 0;
          this.cd.markForCheck();
        },
        err => {
          this.loading = false;
          console.log('err', err);
        });
  }

  private syncMSDUsers() {
    this.loading = true;
    this.orgModelApi.syncMSDUsers(this.userProfile.orgModelId)
      .subscribe((data: any) => {
          console.log('synced msd usres', data);
          this.loading = false;
          this.toastr.success('Synced users successfully');
        },
        err => {
          this.loading = false;
          console.log('err', err);
          this.toastr.error('Error syncing users');
        });
  }

  private syncMSDStores() {
    this.loading = true;
    this.orgModelApi.syncMSDStores(this.userProfile.orgModelId)
      .subscribe((data: any) => {
          console.log('synced msd stores', data);
          this.loading = false;
          this.toastr.success('Synced stores successfully');
        },
        err => {
          this.loading = false;
          console.log('err', err);
          this.toastr.error('Error syncing stores');
        });
  }

  private syncMSDCategories() {
    this.loading = true;
    this.orgModelApi.syncMSDCategories(this.userProfile.orgModelId)
      .subscribe((data: any) => {
          console.log('synced msd categories', data);
          this.loading = false;
          this.toastr.success('Synced categories successfully');
        },
        err => {
          this.loading = false;
          this.toastr.error('Error syncing categories');
          console.log('err', err);
        });
  }

  private syncVendStores() {
    this.loading = true;
    this.orgModelApi.syncVendStores(this.userProfile.orgModelId)
      .subscribe((data: any) => {
        this.loading = false;
        this.toastr.success('Synced stores successfully');
      },
      err => {
        this.loading = false;
        console.log('err', err);
        this.toastr.error('Error in syncing stores');
      });
  }

  private saveCompany() {
    this.loading = true;
    this.orgModelApi.updateByIdIntegrationModels(this.userProfile.orgModelId, this.integration[0].id, {dataAreaId: this.selectedCompany})
      .subscribe((data: any) => {
          this.loading = false;
          this.toastr.success('Company saved successfully');
          this.integration[0].dataAreaId = this.selectedCompany;
          this.cd.markForCheck();
        },
        err => {
          this.loading = false;
          this.toastr.error('Could not save company');
        });
  }

  private validateMSSQLDatabase() {
    if (!this.integration[0].databaseName) {
      this.toastr.error('Please enter a database name to validate');
    }
    else {
      this.orgModelApi.validateMSSQLDatabase(this.userProfile.orgModelId, this.integration[0].databaseName)
        .flatMap((data: any) => {
          if (data && data.success) {
            this.toastr.success('Database validated successfully');
            return this.orgModelApi.getIntegrationModels(this.userProfile.orgModelId);
          }
          else {
            this.toastr.error('Error validating database');
            console.log(data);
            return Observable.empty();
          }
        })
        .catch(err=> {
          this.toastr.error('Error validating database');
          console.log('err', err);
          return Observable.empty();
        })
        .subscribe((data) => {
            if (data.length) {
              this.integration = data;
            }
          },
          err => {
            this.toastr.error('Some error occurred');
            console.log('err', err);
          });
    }
  }

  checkSync(dataObject) {
    // return this.syncModels.find(function (eachSyncModel) {
    //   return eachSyncModel.name === dataObject;
    // }) ? true : false;
  }

  toggleSync(dataObject) {
    // this.loading = true;
    // let filter = {};
    // if (this.checkSync(dataObject)) {
    //   let syncModel = this.syncModels.find(function (eachSyncModel) {
    //     return eachSyncModel.name === dataObject;
    //   });
    //   let syncModelIndex = this.syncModels.indexOf(syncModel);
    //   this.storeConfigModelApi.destroyByIdSyncModels(this.userProfile.storeConfigModelId, syncModel.id)
    //     .subscribe((data: any) => {
    //       this.loading = false;
    //       this.syncModels.splice(syncModelIndex, 1);
    //     }, error => {
    //       console.log('error', error);
    //       this.loading = false;
    //     })
    // }
    // else {
    //   this.storeConfigModelApi.createSyncModels(this.userProfile.storeConfigModelId, {
    //     name: dataObject,
    //     version: 0,
    //     syncInProcess: false
    //   }).subscribe((data: any) => {
    //     this.loading = false;
    //     this.syncModels.push(data);
    //   }, error => {
    //     console.log('error', error);
    //     this.loading = false;
    //   })
  }


}
