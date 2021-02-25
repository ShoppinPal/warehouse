import {Component, OnInit} from '@angular/core';
import {FileUploader} from "ng2-file-upload";
import {OrgModelApi} from "../../shared/lb-sdk/services/custom/OrgModel";
import {ActivatedRoute, Router} from "@angular/router";
import {ToastrService} from "ngx-toastr";
import {UserProfileService} from "../../shared/services/user-profile.service";
import * as XLSX from 'xlsx';
import {constants} from "../../shared/constants/constants";
import {FileImportsResolverService} from "./services/file-imports-resolver.service";
import {flatMap} from 'rxjs/operators';


@Component({
  selector: 'app-file-imports',
  templateUrl: './file-imports.component.html',
  styleUrls: ['./file-imports.component.scss']
})
export class FileImportsComponent implements OnInit {

  public userProfile: any;
  public loading = false;
  public uploader: FileUploader;
  public arrayBuffer: any;
  public fileHeaders: any = {};
  public importableHeaders: any;
  public mappingName: string;
  public mappings: any = {};
  public reportStates: any;
  public orderStatus: string;
  public orderConfigurations: any;
  public groupBy: string;
  public orderName: string;
  public nameSuffixes: Array<any> = [];
  public mappingWindow = false;

  constructor(private orgModelApi: OrgModelApi,
              private _route: ActivatedRoute,
              private _router: Router,
              private toastr: ToastrService,
              private _userProfileService: UserProfileService,
              private _fileImportsResolverService: FileImportsResolverService) {
  }

  ngOnInit() {
    this.userProfile = this._userProfileService.getProfileData();
    this.reportStates = constants.REPORT_STATES;
    this._route.data.subscribe((data: any) => {
        this.populateData(data.data);
      },
      error => {
        console.log('error', error)
      });
  }

  populateData(data) {
    this.importableHeaders = data.importableHeaders;
    this.orderConfigurations = data.orderConfigurations;
    let stockupHeaders = Object.keys(this.importableHeaders);
    this.mappings = {};
    this.fileHeaders = {};
    this.groupBy = '';
    for (var i = 0; i < stockupHeaders.length; i++) {
      this.mappings[stockupHeaders[i]] = [];
    }
  }

  uploadSampleFile($event) {
    //https://stackoverflow.com/questions/47151035/angular-4-how-to-read-data-from-excel?rq=1
    let fileReader: FileReader = new FileReader();
    fileReader.onloadend = (e) => {
      this.arrayBuffer = fileReader.result;
      let data = new Uint8Array(this.arrayBuffer);
      let arr = new Array();
      for (let i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
      let bstr = arr.join("");
      let workbook = XLSX.read(bstr, {type: "binary", sheetRows: 2});
      let first_sheet_name = workbook.SheetNames[0];
      let worksheet = workbook.Sheets[first_sheet_name];
      Object.keys(XLSX.utils.sheet_to_json(worksheet, {raw: true, defval: ''})[0]).forEach(x => {
        this.fileHeaders[x] = {}
      });
    };
    fileReader.readAsArrayBuffer($event.target.files[0]);
    this.mappingWindow = true;
  }

  assignMapping(fileHeader, stockupHeader, stockupSubHeader) {
    if (this.fileHeaders[fileHeader].parent && this.fileHeaders[fileHeader].child) {
      this.removeMapping(fileHeader);
    }
    // to display in UI
    this.fileHeaders[fileHeader] = {
      parent: stockupHeader,
      child: stockupSubHeader
    };
    this.importableHeaders[stockupHeader].splice(this.importableHeaders[stockupHeader].indexOf(stockupSubHeader), 1);
  };

  removeMapping(fileHeader) {
    this.importableHeaders[this.fileHeaders[fileHeader].parent].push(this.fileHeaders[fileHeader].child);
    this.fileHeaders[fileHeader] = {};
  }

  saveMappings() {
    this.loading = true;
    /**
     * mappings object should be of type:
     * mappings = {
     *    Inventory: [
     *      stockupHeader: 'xyz',
     *      fileHeader: 'abc'
     *    ],
     *    Store: [
     *      stockupHeader: 'xyz',
     *      fileHeader: 'abc'
     *    ]
     */
    let mappingsSelected = false;
    Object.keys(this.fileHeaders).forEach(x => {
      if (this.fileHeaders[x] && this.fileHeaders[x].parent && this.fileHeaders[x].child) {
        this.mappings[this.fileHeaders[x].parent].push({
          stockupHeader: this.fileHeaders[x].child,
          fileHeader: x
        });
        mappingsSelected = true;
      }
    });
    if (!mappingsSelected) {
      this.toastr.error('Please select one or more mappings');
      this.loading = false;
    } else if (!this.mappingName) {
      this.toastr.error('Please give this mapping a custom name');
      this.loading = false;
    } else if (!this.orderStatus) {
      this.toastr.error('Please select a status for this order');
      this.loading = false;
    } else if (!this.orderName) {
      this.toastr.error('Please enter a name for order');
      this.loading = false;
    }
    else {
      this.orgModelApi.createOrderConfigModels(this.userProfile.orgModelId, {
        name: this.mappingName,
        mappings: this.mappings,
        groupBy: this.groupBy,
        orderStatus: this.orderStatus,
        orderName: this.orderName,
        orderNameSuffixes: this.nameSuffixes
      })
        .subscribe((data: any) => {
            this.toastr.success('Saved mapping successfully');
            return this._fileImportsResolverService.resolve()
              .subscribe(data => {
                this.populateData(data);
                this.loading = false;
              });
          },
          err => {
            this.toastr.error('Could not save mapping');
            this.loading = false;
          });
    }
  }

  deleteOrderConfig(configId) {
    this.loading = true;
    this.orgModelApi.destroyByIdOrderConfigModels(this.userProfile.orgModelId, configId)
      .subscribe((data: any) => {
        return this._fileImportsResolverService.resolve()
          .subscribe((data: any) => {
            this.populateData(data);
            this.loading = false;
            this.toastr.success('Deleted mapping successfully');
          })
      }, err => {
        this.toastr.error('Could not delete mapping');
        this.loading = false;
      });
  }

  goToFileImportsDetailsPage(configId) {
    this.loading = true;
    this._router.navigate(['file-imports/file-imports-details/' + configId]);
  }

  addNameSuffix() {
    this.nameSuffixes.push({
      header: '',
      defaultValue: ''
    });
  }

  removeNameSuffix(index) {
    this.nameSuffixes.splice(index, 1);
  }


}
