'use strict';

/**
 * @ngdoc function
 * @name ShoppinPalApp.controller:CreateManualOrderCtrl
 * @description
 * # CreateManualOrderCtrl
 * Controller of the ShoppinPalApp
 */
angular.module('ShoppinPalApp').controller(
  'CreateManualOrderCtrl',
  [
    '$sessionStorage', '$q',/* angular's modules/services/factories etc. */
    'LoopBackAuth', 'SupplierModel', 'UserModel', 'ReportModel', 'StockOrderLineitemModel', /* shoppinpal's custom modules/services/factories etc. */
    'Papa', /* 3rd party modules/services/factories etc. */
    function CreateManualOrderCtrl (
      $sessionStorage, $q,
      LoopBackAuth, SupplierModel, UserModel, ReportModel, StockOrderLineitemModel,
      Papa)
    {
      this.storeName = $sessionStorage.currentStore.name;
      this.suppliers = [];
      this.stores = [];
      var self = this;

      // Load the data
      SupplierModel.find({})
        .$promise.then(function(response) {
          self.suppliers = response;
          if(self.suppliers && self.suppliers.length > 0) {
            self.selectedSupplier = self.suppliers[0];
          }

          return UserModel.storeModels({id: LoopBackAuth.currentUserId})
            .$promise.then(function(response){
              self.stores = response;
              if(self.stores && self.stores.length > 0) {
                self.selectedStore = self.stores[0];
              }
            });
        });

      this.createAnEmptyReport = function() {
        return UserModel.reportModels.create(
          {id: LoopBackAuth.currentUserId},
          {
            name: self.orderName,
            state: 'empty',
            outlet: {
              id: self.selectedStore.api_id, // jshint ignore:line
              name: self.selectedStore.name
            },
            supplier: {
              id: self.selectedSupplier.apiId,
              name: self.selectedSupplier.name
            }
          }
        );
      };

      /** @method generateOrder
       * This method will move to generate store report for particular store
       */
      this.generateOrder = function(){
        console.log('inside generateOrder()',
          '\norderName', this.orderName,
          '\nselectedStoreId', this.selectedStore.api_id, // jshint ignore:line
          '\nselectedSupplierId', this.selectedSupplier.apiId
        );
        return self.createAnEmptyReport()
          .$promise.then(function(reportModelInstance){
            //return Parse.Promise.as(reportModelInstance);
            console.log(reportModelInstance);
            ReportModel.generateStockOrderReportForManager(
              {
                id: reportModelInstance.id
              },
              function(response){
                console.log(response);
              },
              function(err){
                console.error(err);
              });
          });
      };

      this.myFile = undefined;
      this.importOrder = function(){
        console.log(this.myFile);

        Papa.parse(this.myFile, {
          header: true,
          complete: function(results) {
            console.log('All done!');
            console.log(results);
            // TODO: (1) create a ReportModel
            return self.createAnEmptyReport()
              .$promise.then(function(reportModelInstance){
                console.log('created reportModelInstance:', reportModelInstance);

                var normalizedStoreName = self.selectedStore.name.replace(/ /g,'_');
                console.log('normalizedStoreName:', normalizedStoreName);

                var uploads = [];
                _.each(results.data, function(data) {
                  uploads.push({
                    sku: data.sku,
                    name: data.name,
                    quantityOnHand: data['inventory_'+normalizedStoreName],
                    desiredStockLevel: data['reorder_point_'+normalizedStoreName],
                    orderQuantity: data['reorder_point_'+normalizedStoreName],
                    type: data.type,
                    reportId: reportModelInstance.id,
                    userId: LoopBackAuth.currentUserId
                  });
                });

                return uploads.reduce(function(promise, item) {
                  return promise.then(function(/*result*/) {
                    return StockOrderLineitemModel.create(item);
                  });
                }, $q.when())
                  .then(function(){
                    return ReportModel.prototype$updateAttributes(
                      { id: reportModelInstance.id },
                      { state: 'manager' }
                    )
                      .$promise.then(function(updatedReportModelInstance){
                        console.log('updatedReportModelInstance', updatedReportModelInstance);
                      });
                  });

              });
          }
        });
      };
    }
  ]);
