module MarvelWidget {
    export class MarvelWidgetData {
        title: string;
        /** Folder containing the marvel diagrams */
        marvelFolder: string;
        /**
         * If provided, indicates the feature type that needs to be selected in order to show the widget.
         */
        featureTypeName: string;
    }

    export interface IDependency {
        label: string;
        type: string;
    }

    export interface IMarvelWidgetScope extends ng.IScope {
        vm: MarvelWidgetCtrl;
        data: MarvelWidgetData;
        minimized: boolean;
        editmode: boolean;
        selectedFeature: csComp.Services.IFeature;
        dependencyTypes: { [key: string]: IDependency };
    }

    export class MarvelWidgetCtrl {
        private scope: IMarvelWidgetScope;
        private widget: csComp.Services.IWidget;
        private parentWidget: JQuery;

        public static $inject = [
            '$scope',
            '$timeout',
            'layerService',
            'messageBusService',
            'mapService'
        ];

        constructor(
            private $scope: IMarvelWidgetScope,
            private $timeout: ng.ITimeoutService,
            private $layerService: csComp.Services.LayerService,
            private $messageBus: csComp.Services.MessageBusService,
            private $mapService: csComp.Services.MapService
            ) {
            $scope.vm = this;
            var par = <any>$scope.$parent;
            this.widget = par.widget;
            this.parentWidget = $("#" + this.widget.elementId).parent();
            this.initDependencies();

            $scope.data = <MarvelWidgetData>this.widget.data;
            $scope.minimized = false;
            $scope.editmode = false;

            if (typeof $scope.data.featureTypeName !== 'undefined') {
                // Hide widget
                this.parentWidget.hide();
                this.$messageBus.subscribe('feature', (action: string, feature: csComp.Services.IFeature) => {
                    switch (action) {
                        case 'onFeatureDeselect':
                        case 'onFeatureSelect':
                            this.selectFeature(feature);
                            break;
                        default:
                            break;
                    }
                });
            }
        }

        private initDependencies(): { [key: string]: IDependency } {
            this.$scope.dependencyTypes = {};
            this.$scope.dependencyTypes['_dep_water'] = { label: 'Water level [m]', type: 'number' };
            this.$scope.dependencyTypes['_dep_UPS'] = { label: 'UPS duration [mins]', type: 'number' };
            this.$scope.dependencyTypes['_dep_features'] = { label: 'Specific features', type: 'stringarray' };
            return {};
        }

        private minimize() {
            this.$scope.minimized = !this.$scope.minimized;
            if (this.$scope.minimized) {
                this.parentWidget.css("height", "30px");
            } else {
                this.parentWidget.css("height", this.widget.height);
            }
        }

        private edit() {
            (this.$scope.editmode) ? this.save() : null;
            this.$scope.editmode = !this.$scope.editmode;
        }

        private close() {
            this.parentWidget.hide();
        }

        private escapeRegExp(str: string) {
            return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        }

        private replaceAll(str: string, find: string, replace: string) {
            return str.replace(new RegExp(this.escapeRegExp(find), 'g'), replace);
        }

        private addDependency(id: string, dep: IDependency) {
            if (this.$scope.selectedFeature.properties.hasOwnProperty(id)) {
                delete this.$scope.selectedFeature.properties[id];
            } else {
                switch (dep.type) {
                    case 'number':
                        this.$scope.selectedFeature.properties[id] = 0;
                        break;
                    case 'string':
                        this.$scope.selectedFeature.properties[id] = '';
                        break;
                    case 'stringarray':
                        this.$scope.selectedFeature.properties[id] = [];
                        break;
                    default:
                        this.$scope.selectedFeature.properties[id] = null;
                        break;
                }
            }
        }

        private addDependencyFeature(dep: string) {
            if (!this.$scope.selectedFeature.properties.hasOwnProperty(dep)) return;
            var newVal = $('#add-' + dep).val();
            if (!newVal || (newVal === '')) return;
            if (!this.$scope.selectedFeature.properties[dep].some((d) => { return newVal === d; })) {
                this.$scope.selectedFeature.properties[dep].push(newVal);
                $('#add-' + dep).val('');
            }
        }

        private removeDependencyFeature(dep: string, name: string) {
            if (this.$scope.selectedFeature.properties.hasOwnProperty(dep)) {
                this.$scope.selectedFeature.properties[dep] = this.$scope.selectedFeature.properties[dep].filter((d) => { return name !== d; });
            }
        }

        private save() {
            var f = this.$scope.selectedFeature;
            var s = new csComp.Services.LayerUpdate();
            s.layerId = f.layerId;
            s.action = csComp.Services.LayerUpdateAction.updateFeature;
            s.item = csComp.Services.Feature.serialize(f);
            this.$messageBus.serverSendMessageAction("layer", s);
            console.log('Published feature changes');
        }

        private selectFeature(feature: csComp.Services.IFeature) {
            if (!feature || !feature.isSelected) {
                this.parentWidget.hide();
                return;
            }
            if (typeof this.$scope.data.marvelFolder === 'undefined') return;
            if (!feature.fType || !feature.fType.name) return;
            this.$scope.selectedFeature = feature;
            var featureTypeName = feature.fType.name.replace(/(\_\d$)/, ''); // Remove state appendix (e.g. Hospital_0)
            var filePath = this.$scope.data.marvelFolder + featureTypeName + '.mrvjson';
            this.parentWidget.show();
            $.get(filePath, (marvel) => {
                this.$timeout(() => {
                    this.$scope.data.title = featureTypeName;
                    var w = $("#" + this.widget.elementId);
                    Marvelous.model(marvel, featureTypeName, w);
                }, 0);
            });
        }
    }

}